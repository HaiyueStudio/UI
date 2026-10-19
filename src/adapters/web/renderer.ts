import type { HYCapabilities, HYMutation, HYNode, HYRenderer, HYUIEvent } from '../../core/types.js';
import { HY_COMPONENTS, HYUIError, hyValidateProps } from '../../core/validation.js';
import { HYPlatformViewController } from '../../core/platform-view.js';
import { equalData } from '../../core/data.js';
import { hyThemeVariables } from '../../portable/theme.js';
import { HYDialog } from '../../dialog.js';
import { HYTabs } from '../../tabs.js';
import { componentTags, createControl } from './controls.js';
import { applyAccessibility, applyLayout, attribute, captureFocus, deepActive, flag, focusable } from './dom.js';
import { componentCSS, rootCSS } from './styles.js';
import type { HYWebControl, HYWebDiagnostics, HYWebEnvironment, HYWebRendererOptions } from './types.js';

interface Entry {
  node: HYNode; readonly element: HTMLElement; parent: string|null|undefined; slot: string|undefined;
  control?: HYWebControl; readonly cleanup: Set<()=>void>; readonly slots: Map<string,HTMLElement>;
  platform?: HYPlatformViewController; platformMounted: boolean;
  label?: HTMLElement; error?: HTMLElement; readonly id: string;
}
const tags: Record<string,string> = {Row:'div',Column:'div',Grid:'div',Overlay:'div',Scroll:'div',Text:'span',Image:'img',Icon:'img',TextArea:'textarea',FormGroup:'fieldset',PlatformView:'div',...componentTags};
let rendererSequence=0;

/** Browser-only adapter. Explicit registration and an attached, same-realm mount point are required. */
export class HYWebRenderer implements HYRenderer {
  readonly capabilities: HYCapabilities = Object.freeze({contract:1,backend:'web',components:HY_COMPONENTS,
    features:Object.freeze(['text.composition','text.selection','text.secure','accessibility','layout.rtl','motion.reduced'])});
  readonly #root: HTMLDivElement; readonly #nodes=new Map<string,Entry>(); readonly #cleanup=new Set<()=>void>();
  readonly #identity=++rendererSequence;
  #emit: ((event:HYUIEvent)=>void)|undefined; #mounted=false; #disposed=false; #suspended=false; #applying=false;
  #revision=0; #failure:HYUIError|undefined; #resize:ResizeObserver|undefined; #frame:number|undefined;
  #themeKeys:string[]=[]; #sequence=0;
  #counts={commits:0,created:0,updated:0,moved:0,removed:0,measurements:0,activeListeners:0};
  constructor(private readonly host:HTMLElement,private readonly options:HYWebRendererOptions={}) {
    if(host.ownerDocument.defaultView!==window)throw new HYUIError('capability','Web renderer requires a mount point in the current browser realm');
    this.#root=document.createElement('div');this.#root.dataset.hyPortableRoot='';
    const style=document.createElement('style');style.textContent=rootCSS;this.#root.append(style);
    this.setEnvironment(options.environment??{});
  }
  get diagnostics():HYWebDiagnostics {return Object.freeze({...this.#counts,activeNodes:this.#nodes.size,activeResources:[...this.#nodes.values()].filter(e=>e.platformMounted).length});}
  mount(emit:(event:HYUIEvent)=>void):void {
    if(this.#mounted||this.#disposed)throw new HYUIError('lifecycle','Web renderer already mounted or disposed');
    if(!this.host.isConnected)throw new HYUIError('lifecycle','Web renderer mount point must be connected');
    this.#mounted=true;this.#emit=emit;this.host.append(this.#root);
    this.#resize=new ResizeObserver(()=>this.#scheduleLayout());
    this.#listen(this.#cleanup,window,'resize',()=>this.#scheduleLayout());
    this.#listen(this.#cleanup,window,'scroll',()=>this.#scheduleLayout(),true);
    if(window.visualViewport)for(const type of ['resize','scroll'])this.#listen(this.#cleanup,window.visualViewport,type,()=>this.#scheduleLayout());
    this.#listen(this.#cleanup,this.#root,'keydown',event=>this.#trapTab(event as KeyboardEvent));
  }
  #assertReady():void {
    if(this.#failure)throw this.#failure;
    if(!this.#mounted||this.#disposed)throw new HYUIError('lifecycle','Web renderer is not mounted');
  }
  commit(revision:number,mutations:readonly HYMutation[]):void {
    this.#assertReady();
    if(this.#applying||!Number.isSafeInteger(revision)||revision<=this.#revision)throw new HYUIError('lifecycle','Non-monotonic or reentrant renderer commit',{revision});
    const restore=captureFocus(document);this.#applying=true;
    let current:HYMutation|undefined;
    try {
      const local = mutations.every(m=>m.type==='update'&&['Text','Button','Toggle','Select','TextInput','TextArea','Slider','Image','Icon'].includes(m.node.kind));
      // Leaf value/text updates preserve the relation tree and accessible label.
      // Containers, structural edits and changed accessibility props still sync.
      const relations = local ? mutations.filter(m=>{
        const node=(m as Extract<HYMutation,{type:'update'}>).node;
        return !equalData(this.#get(node.key).node.props.a11y,node.props.a11y);
      }).map(m=>this.#get((m as Extract<HYMutation,{type:'update'}>).node.key)) : undefined;
      for(const mutation of mutations){current=mutation;this.#mutate(mutation,revision);}
      current=undefined;
      this.#syncRelations(relations??this.#nodes.values());
      this.#syncResources();restore();
      this.#revision=revision;this.#counts.commits++;
    }catch(cause){
      const key=current?('node'in current?current.node.key:current.key):'<page>';
      const error=new HYUIError('renderer','Web mutation failed',{key,operation:current?.type??'finalize',revision,
        ...(cause instanceof HYUIError?cause.context:{})},cause);
      this.#failure=error;throw error;
    }finally{this.#applying=false;}
  }
  #mutate(mutation:HYMutation,revision:number):void {
    if(mutation.type==='create'){
      if(this.#nodes.has(mutation.node.key))throw new HYUIError('duplicate-key','Duplicate renderer key');
      const entry=this.#create(mutation.node,revision);this.#update(entry,mutation.node,revision);this.#counts.created++;return;
    }
    if(mutation.type==='update'){
      const entry=this.#get(mutation.node.key);
      if(entry.node.kind!==mutation.node.kind)throw new HYUIError('invalid-props','Changing kind requires remove/create');
      this.#update(entry,mutation.node,revision);this.#counts.updated++;return;
    }
    const entry=this.#get(mutation.key);
    if(mutation.type==='remove'){this.#remove(entry);return;}
    if(mutation.type==='insert'&&entry.parent!==undefined)throw new HYUIError('lifecycle','Node already inserted');
    if(mutation.type==='move'&&entry.parent===undefined)throw new HYUIError('lifecycle','Cannot move a detached node');
    const parent=mutation.parent===null?undefined:this.#get(mutation.parent);
    const container=parent?this.#container(parent,mutation.slot):this.#root;
    if(!parent&&mutation.slot!==undefined)throw new HYUIError('invalid-props','Root cannot have a named slot');
    const before=mutation.before===null?null:this.#get(mutation.before);
    if(before&&(before.parent!==mutation.parent||before.slot!==mutation.slot))throw new HYUIError('invalid-props','Placement anchor belongs to a different slot');
    let ancestor=parent;
    while(ancestor){if(ancestor===entry)throw new HYUIError('invalid-props','Cyclic renderer placement');ancestor=ancestor.parent?this.#nodes.get(ancestor.parent):undefined;}
    entry.parent=mutation.parent;entry.slot=mutation.slot;
    attribute(entry.element,'slot',parent&&(parent.node.kind==='Tabs'||parent.node.kind==='Dialog')?mutation.slot:undefined);
    const movable=container as HTMLElement&{moveBefore?:(node:Node,before:Node|null)=>void};
    if(mutation.type==='move'&&entry.element.isConnected&&container.isConnected&&movable.moveBefore)movable.moveBefore(entry.element,before?.element??null);
    else container.insertBefore(entry.element,before?.element??null);
    applyLayout(entry.element,entry.node.props.layout,parent?.node.kind==='Overlay');
    if(mutation.type==='move')this.#counts.moved++;
  }
  #get(key:string):Entry {const entry=this.#nodes.get(key);if(!entry)throw new HYUIError('invalid-props','Unknown renderer key',{key});return entry;}
  #create(node:HYNode,revision:number):Entry {
    const tag=tags[node.kind];
    if(!tag)throw new HYUIError('capability','Unsupported Web component',{key:node.key});
    if(tag.startsWith('hy-')&&!customElements.get(tag))throw new HYUIError('lifecycle','Call definePortableWebComponents() before mounting',{key:node.key});
    const element=document.createElement(tag);element.dataset.hyKey=node.key;element.dataset.hyKind=node.kind;
    const entry:Entry={node,element,parent:undefined,slot:undefined,cleanup:new Set(),slots:new Map(),platformMounted:false,id:`hy-portable-${this.#identity}-${++this.#sequence}`};
    // Register immediately so a failed initialization is still owned by dispose().
    this.#nodes.set(node.key,entry);
    if(element.shadowRoot){const style=document.createElement('style');style.textContent=componentCSS;element.shadowRoot.append(style);}
    const control=createControl(node,{host:element,emit:event=>this.#event(entry,event),interactive:()=>this.#interactive(entry),
      listen:(target,type,listener,capture=false)=>this.#listen(entry.cleanup,target,type,event=>{
        const owner=event.composedPath().find(item=>item instanceof HTMLElement&&item.hasAttribute('data-hy-key'));
        const buttonContent=node.kind==='Button'&&event.type==='click'&&owner instanceof Node&&element.contains(owner);
        if(this.#interactive(entry)&&(!owner||owner===element||buttonContent))listener(event);
      },capture)},revision);
    if(control)entry.control=control;
    if(node.kind!=='TextInput'&&node.kind!=='TextArea'){
      for(const type of ['focusin','focusout'])this.#listen(entry.cleanup,element,type,event=>{
        const owner=event.composedPath().find(item=>item instanceof HTMLElement&&item.hasAttribute('data-hy-key'));
        if(owner===element)this.#event(entry,{key:node.key,type:type==='focusin'?'focus':'blur',reason:'keyboard',transaction:0});
      });
    }
    if(node.kind==='FormGroup'){
      entry.label=document.createElement('legend');entry.error=document.createElement('span');entry.error.dataset.hyError='';
      entry.label.id=`${entry.id}-label`;entry.error.id=`${entry.id}-error`;element.append(entry.label,entry.error);
    }
    if(node.kind==='PlatformView'){
      const factory=this.options.platformViews?.[node.props.slot];
      if(!factory)throw new HYUIError('capability',`No PlatformView factory for ${node.props.slot}`,{key:node.key});
      entry.platform=new HYPlatformViewController(()=>factory(element,{key:node.key,slot:node.props.slot}),node.props.resourceId,node.props.visible!==false);
    }
    return entry;
  }
  #update(entry:Entry,node:HYNode,revision:number):void {
    hyValidateProps(node.kind,node.props,{key:node.key,...(node.source?{source:node.source}:{})},this.capabilities);
    const previous=entry.node;
    if(node.kind==='PlatformView'&&previous.kind==='PlatformView'&&node.props.slot!==previous.props.slot)throw new HYUIError('invalid-props','PlatformView factory slot is immutable; use a new key',{key:node.key});
    entry.node=node;const element=entry.element;
    if(entry.parent===undefined||!equalData(previous.props.layout,node.props.layout))
      applyLayout(element,node.props.layout,entry.parent?this.#nodes.get(entry.parent)?.node.kind==='Overlay':false);
    flag(element,'hidden',node.props.visible===false);
    entry.control?.update(node,revision);
    if(node.kind==='Text'){if(element.textContent!==node.props.text)element.textContent=node.props.text;element.style.whiteSpace=node.props.wrap===false?'pre':'pre-wrap';}
    if(node.kind==='Scroll'){
      element.style.overflowX=node.props.axis==='horizontal'?'auto':'hidden';element.style.overflowY=node.props.axis==='vertical'?'auto':'hidden';
      if(node.props.layout?.clip)element.style.overflow='hidden';element.tabIndex=0;
    }
    if(node.kind==='Image'||node.kind==='Icon'){
      const image=element as HTMLImageElement;
      if(!image.hasAttribute('src')||!('resource'in previous.props)||!equalData(node.props.resource,previous.props.resource)){
        const url=this.options.resolveResource?.(node.props.resource,{key:node.key,kind:node.kind});
        if(typeof url!=='string'||!url.trim())throw new HYUIError('capability',`Unresolved image resource ${node.props.resource.id}`,{key:node.key});
        image.src=url;
      }
      image.alt=node.props.resource.alt;image.style.objectFit=node.kind==='Image'?(node.props.fit??'contain'):'contain';
    }
    if(node.kind==='FormGroup'){
      entry.label!.textContent=node.props.label;entry.error!.textContent=node.props.error??'';entry.error!.hidden=!node.props.error;
    }
    if(node.kind==='PlatformView')entry.platform!.update(node.props.resourceId);
    if(node.kind==='Tabs')for(const child of this.#nodes.values())if(child.parent===node.key)this.#container(entry,child.slot);
  }
  #container(parent:Entry,slot:string|undefined):HTMLElement {
    if(parent.node.kind==='Tabs'){
      if(slot===undefined||!parent.node.props.options.some(option=>option.value===slot))throw new HYUIError('capability','Tabs children need an option-valued named slot',{key:parent.node.key});
      return parent.element;
    }
    if(parent.node.kind==='Dialog'){
      if(slot!==undefined&&slot!=='footer')throw new HYUIError('capability','Dialog supports only the footer named slot',{key:parent.node.key});
      return parent.element;
    }
    if(!['Row','Column','Grid','Overlay','Scroll','FormGroup','Button'].includes(parent.node.kind))throw new HYUIError('capability','This component cannot contain children',{key:parent.node.key});
    if(slot===undefined)return parent.element;
    if(parent.node.kind==='Button')throw new HYUIError('capability','Button supports only default content',{key:parent.node.key});
    let group=parent.slots.get(slot);
    if(!group){group=document.createElement('div');group.dataset.hySlotGroup=slot;parent.element.append(group);parent.slots.set(slot,group);}
    return group;
  }
  #shown(entry:Entry):boolean {
    let current:Entry|undefined=entry;
    while(current){
      if(current.node.props.visible===false||(current.node.kind==='Dialog'&&!current.node.props.open))return false;
      const parent:Entry|undefined=current.parent?this.#nodes.get(current.parent):undefined;
      if(parent?.node.kind==='Tabs'&&current.slot!==parent.node.props.value)return false;
      current=parent;
    }
    return true;
  }
  #interactive(entry:Entry):boolean {
    if(this.#disposed||this.#suspended||this.#applying||this.#failure||!this.#nodes.has(entry.node.key)||!this.#shown(entry))return false;
    let current:Entry|undefined=entry;
    while(current){
      const props=current.node.props;
      if(('disabled'in props&&props.disabled)||('busy'in props&&props.busy))return false;
      current=current.parent?this.#nodes.get(current.parent):undefined;
    }
    return true;
  }
  #event(entry:Entry,event:HYUIEvent):void {if(this.#interactive(entry))this.#emit?.(event);}
  #syncRelations(entries:Iterable<Entry>=this.#nodes.values()):void {
    for(const entry of entries){
      if(entry.element instanceof HYDialog)entry.element.open=!this.#suspended&&this.#shown(entry);
      this.#a11y(entry);
      for(const [name,container]of entry.slots)if(!container.childElementCount){container.remove();entry.slots.delete(name);}
    }
  }
  #a11y(entry:Entry):void {
    const {element,node}=entry;
    let group:Entry|undefined=entry.parent?this.#nodes.get(entry.parent):undefined;
    while(group&&group.node.kind!=='FormGroup')group=group.parent?this.#nodes.get(group.parent):undefined;
    const groupProps=group?.node.kind==='FormGroup'?group.node.props:undefined;
    const label=node.props.a11y?.label??(entry.control||node.kind==='TextArea'?groupProps?.label:undefined);
    const description=[node.props.a11y?.description,node.props.a11y?.error??groupProps?.error].filter(Boolean).join('. ');
    const a11y=label===undefined?undefined:{...node.props.a11y,label,...(groupProps?.error&&!node.props.a11y?.error?{error:groupProps.error}:{})};
    applyAccessibility(element,a11y);
    const targets=element instanceof HYTabs?[...element.shadowRoot!.querySelectorAll<HTMLElement>('[role=tablist],button')]
      :element.shadowRoot?[element.shadowRoot.querySelector<HTMLElement>(node.kind==='Slider'?'button.upper':'input:not([type=search]),select,button,dialog')].filter((el):el is HTMLElement=>!!el):[element];
    for(const target of targets){
      // Tabs label belongs to the tablist; each tab keeps its option name.
      if(!(element instanceof HYTabs)||target.getAttribute('role')==='tablist')applyAccessibility(target,a11y);
      attribute(target,'aria-description',description||undefined);
      attribute(target,'aria-invalid',(node.props.a11y?.error??groupProps?.error)?'true':undefined);
      if(description){
        const scope=target.getRootNode();
        // References stay in the same tree scope, including inside legacy ShadowRoots.
        if(scope instanceof ShadowRoot){
          let info=scope.querySelector<HTMLElement>('[data-hy-a11y-description]');
          if(!info){info=document.createElement('span');info.dataset.hyA11yDescription='';info.id=`${entry.id}-description`;info.hidden=true;scope.append(info);}
          if(info.textContent!==description)info.textContent=description;
          attribute(target,'aria-describedby',info.id);
        }
      }else attribute(target,'aria-describedby',undefined);
    }
    if(!entry.control&&node.kind!=='TextArea'){
      const role=node.props.a11y?.role;
      attribute(element,'role',role==='text'?undefined:role==='image'?'img':role);
    }
  }
  #syncResources():void {
    for(const entry of this.#nodes.values())if(entry.platform&&entry.element.isConnected){
      try{
        entry.platform.visible(this.#shown(entry));
        if(!entry.platformMounted){if(this.#suspended)entry.platform.suspend();entry.platform.mount();entry.platformMounted=true;this.#resize?.observe(entry.element);}
        if(this.#suspended)entry.platform.suspend();
        else {
          entry.platform.resume();const rect=entry.element.getBoundingClientRect();this.#counts.measurements++;
          entry.platform.layout({x:rect.x,y:rect.y,width:rect.width,height:rect.height,scale:window.devicePixelRatio||1});
        }
      }catch(cause){throw new HYUIError('renderer','PlatformView lifecycle failed',{key:entry.node.key,...(entry.node.source?{source:entry.node.source}:{})},cause);}
    }
  }
  #scheduleLayout():void {
    if(this.#frame!==undefined||this.#disposed||this.#suspended||this.#failure)return;
    this.#frame=requestAnimationFrame(()=>{this.#frame=undefined;try{this.#syncResources();}catch(cause){
      const error=new HYUIError('renderer','Web resource layout failed',{operation:'layout',revision:this.#revision,...(cause instanceof HYUIError?cause.context:{})},cause);this.#failure=error;
      if(this.options.onError)this.options.onError(error);else queueMicrotask(()=>{throw error;});
    }});
  }
  #trapTab(event:KeyboardEvent):void {
    if(event.key!=='Tab'||event.defaultPrevented||this.#suspended)return;
    const dialog=[...this.#nodes.values()].filter(entry=>entry.element instanceof HYDialog&&entry.element.open).at(-1);
    if(!dialog)return;
    const choices=focusable(dialog.element.shadowRoot!),active=deepActive(document);
    const index=choices.findIndex(choice=>choice===active);
    if(!choices.length){event.preventDefault();dialog.control?.focus();return;}
    if((event.shiftKey&&index<=0)||(!event.shiftKey&&(index===choices.length-1||index===-1))){event.preventDefault();choices[event.shiftKey?choices.length-1:0]!.focus();}
  }
  focus(key:string):void {
    this.#assertReady();const entry=this.#get(key);if(this.#suspended||!this.#shown(entry))return;
    if(entry.platform){entry.platform.focus();return;}
    if(entry.control){entry.control.focus();return;}
    if(entry.element.tabIndex<0)entry.element.tabIndex=-1;
    entry.element.focus({preventScroll:true});
  }
  setEnvironment(environment:HYWebEnvironment):void {
    if(this.#disposed)throw new HYUIError('lifecycle','Web renderer disposed');
    const {safeArea=[0,0,0,0],fontScale=1,direction='ltr'}=environment;
    if(!Number.isFinite(fontScale)||fontScale<=0||!['ltr','rtl'].includes(direction)
      ||(safeArea!=='environment'&&(!Array.isArray(safeArea)||safeArea.length!==4||!safeArea.every(v=>Number.isFinite(v)&&v>=0))))throw new HYUIError('invalid-props','Invalid Web environment');
    const theme=environment.theme?hyThemeVariables(environment.theme,fontScale):undefined;
    for(const key of this.#themeKeys)this.#root.style.removeProperty(key);this.#themeKeys=[];
    if(theme){for(const [key,value]of Object.entries(theme)){this.#root.style.setProperty(key,value);this.#themeKeys.push(key);}}
    else if(environment.fontScale!==undefined){
      const inherited=getComputedStyle(this.host);
      for(const [key,fallback]of [['--hy-font-size',14],['--hy-line-height',22]] as const){const base=parseFloat(inherited.getPropertyValue(key))||fallback;this.#root.style.setProperty(key,`${base*fontScale}px`);this.#themeKeys.push(key);}
    }
    this.#root.dir=direction;flag(this.#root,'data-hy-reduced-motion',!!environment.reducedMotion);
    this.#root.style.padding=safeArea==='environment'?['top','right','bottom','left'].map(side=>`env(safe-area-inset-${side}, 0px)`).join(' '):safeArea.map(value=>`${value}px`).join(' ');
    this.#scheduleLayout();
  }
  suspend():void {this.#assertReady();if(this.#suspended)return;this.#suspended=true;this.#root.inert=true;this.#syncRelations();for(const entry of this.#nodes.values())entry.platform?.suspend();}
  resume():void {this.#assertReady();if(!this.#suspended)return;this.#suspended=false;this.#root.inert=false;this.#applying=true;try{this.#syncRelations();this.#syncResources();}finally{this.#applying=false;}}
  #listen(cleanup:Set<()=>void>,target:EventTarget,type:string,listener:(event:Event)=>void,capture=false):()=>void {
    target.addEventListener(type,listener,capture);this.#counts.activeListeners++;let live=true;
    const off=():void=>{if(!live)return;live=false;target.removeEventListener(type,listener,capture);cleanup.delete(off);this.#counts.activeListeners--;};cleanup.add(off);return off;
  }
  #remove(entry:Entry):void {
    const errors:unknown[]=[];
    for(const child of [...this.#nodes.values()])if(child.parent===entry.node.key)try{this.#remove(child);}catch(cause){errors.push(cause);}
    for(const off of entry.cleanup)off();
    this.#resize?.unobserve(entry.element);
    try{entry.control?.dispose();}catch(cause){errors.push(cause);}
    try{entry.platform?.dispose();}catch(cause){errors.push(cause);}
    entry.element.remove();this.#nodes.delete(entry.node.key);this.#counts.removed++;
    if(errors.length)throw new AggregateError(errors,'Web node cleanup failed');
  }
  dispose():void {
    if(this.#disposed)return;this.#disposed=true;
    if(this.#frame!==undefined)cancelAnimationFrame(this.#frame);this.#resize?.disconnect();
    const errors:unknown[]=[];
    while(this.#nodes.size)try{this.#remove(this.#nodes.values().next().value!);}catch(cause){errors.push(cause);}
    for(const off of this.#cleanup)off();this.#root.remove();this.#emit=undefined;
    if(errors.length)throw new AggregateError(errors,'Web renderer cleanup failed');
  }
}
