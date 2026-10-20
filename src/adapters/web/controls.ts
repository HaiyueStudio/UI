import { HYButtonController, HYToggleController, HYSliderController } from '../../core/actions.js';
import { HYSelectionController } from '../../core/selection.js';
import { HYTextController } from '../../core/text.js';
import { equalData } from '../../core/data.js';
import type { HYNode, HYReason, HYSelectionProps, HYTextProps } from '../../core/types.js';
import { HYButton, defineButtonComponents } from '../../button.js';
import { HYCheckbox, defineCheckboxComponents } from '../../checkbox.js';
import { HYSelect, defineSelectComponents } from '../../select.js';
import { HYTabs, defineTabsComponents } from '../../tabs.js';
import { HYInput, defineInputComponents } from '../../input.js';
import { HYRange, defineRangeComponents } from '../../range.js';
import { HYDialog, defineDialogComponents } from '../../dialog.js';
import {defineRadioComponents} from '../../radio.js';
import {defineRateComponents} from '../../rate.js';
import {defineBadgeComponents} from '../../badge.js';
import {defineDividerComponents} from '../../divider.js';
import type { HYWebControl, HYWebControlContext } from './types.js';
import { attribute, flag, focusable } from './dom.js';

/** Registration is explicit and limited to the reused components. */
export function definePortableWebComponents(): void {
  defineButtonComponents(); defineCheckboxComponents(); defineSelectComponents(); defineTabsComponents();
  defineRadioComponents(); defineRateComponents(); defineBadgeComponents(); defineDividerComponents();
  defineInputComponents(); defineRangeComponents(); defineDialogComponents();
}
export const componentTags = Object.freeze({ Checkbox:'hy-checkbox',RadioGroup:'div',Rate:'hy-rate',Badge:'hy-badge',Divider:'hy-divider',Button:'hy-button',Toggle:'hy-checkbox',Select:'hy-select',Tabs:'hy-tabs',TextInput:'hy-input',Slider:'hy-range',Dialog:'hy-dialog' });

let radioGroupSequence=0;
function toggleProps(node:Extract<HYNode,{kind:'Toggle'|'Checkbox'}>) { const {checked,disabled,visible}=node.props;return {checked,...(disabled===undefined?{}:{disabled}),...(visible===undefined?{}:{visible})}; }

export function createControl(node: HYNode, context: HYWebControlContext, revision: number): HYWebControl | undefined {
  const {host,listen,emit}=context;
  let reason: HYReason='accessibility', transaction=0;
  listen(host,'pointerdown',()=>{reason='pointer';},true);
  listen(host,'keydown',()=>{reason='keyboard';},true);
  if(node.kind==='Badge'||node.kind==='Divider')return {update(next){if(next.kind==='Badge'){flag(host,'literal',true);attribute(host,'count',next.props.text);};if(next.kind==='Divider')attribute(host,'label',next.props.text);},focus(){},dispose(){}};
  if(node.kind==='RadioGroup') {
    const controller=new HYSelectionController(node.key,node.props,emit);
    let props=node.props;
    const buttons=new Map<string,HTMLElement>(),groupName=`hy-portable-radio-${++radioGroupSequence}`;
    host.setAttribute('role','radiogroup');
    const render=()=>{for(const [value,button] of buttons){flag(button,'checked',props.value===value);flag(button,'disabled',!!props.disabled||!!props.options.find(o=>o.value===value)?.disabled);}};
    listen(host,'checked-change',event=>{const detail=(event as CustomEvent<{checked:boolean,value:string}>).detail;if(detail.checked)controller.choose(detail.value,reason);render();});
    return {update(next){if(next.kind!=='RadioGroup')return;props=next.props;controller.update(props);
      for(const [value,button] of buttons)if(!props.options.some(o=>o.value===value)){button.remove();buttons.delete(value);}
      for(const option of props.options){let button=buttons.get(option.value);if(!button){button=document.createElement('hy-radio');buttons.set(option.value,button);}attribute(button,'value',option.value);attribute(button,'label',option.label);attribute(button,'name',groupName);host.append(button);}render();},
      focus(){focusable(host)[0]?.focus();},dispose(){controller.dispose();buttons.clear();}};
  }
  if(node.kind==='Rate') {
    let props=node.props,disposed=false,choosing=false;
    const restore=()=>attribute(host,'value',String(props.value));
    listen(host,'value-change',event=>{const value=(event as CustomEvent<{value:number}>).detail.value;
      if(disposed||choosing||props.disabled||props.readOnly||value===props.value)return;
      choosing=true;const tx=++transaction;try{emit({key:node.key,type:'valueChange',value,reason,transaction:tx});if(!disposed)emit({key:node.key,type:'commit',value,reason,transaction:tx});}finally{choosing=false;if(!disposed)restore();}});
    return {update(next){if(next.kind!=='Rate')return;props=next.props;attribute(host,'count',String(props.count));flag(host,'disabled',!!props.disabled);flag(host,'readonly',!!props.readOnly);restore();},focus(){focusable(host)[0]?.focus();},dispose(){disposed=true;}};
  }
  if (node.kind === 'Button') {
    const button=host as HYButton;
    const label=document.createElement('span');label.dataset.hyButtonLabel='';button.append(label);
    const controller=new HYButtonController(node.key,node.props,emit);
    listen(button,'click',()=>controller.activate(reason));
    return {
      update(next) { if(next.kind!=='Button')return;controller.update(next.props);if(label.textContent!==next.props.text)label.textContent=next.props.text;
        flag(button,'disabled',!!next.props.disabled||!!next.props.busy);attribute(button,'aria-busy',next.props.busy?'true':undefined); },
      focus(){button.shadowRoot!.querySelector('button')!.focus();},dispose(){controller.dispose();},
    };
  }
  if (node.kind === 'Toggle' || node.kind === 'Checkbox') {
    const toggle=host as HYCheckbox;
    const controller=new HYToggleController(node.key,toggleProps(node),emit);
    listen(toggle,'checked-change',event=>{controller.choose((event as CustomEvent<{checked:boolean}>).detail.checked,reason);
      // The app may reject a discrete change; restore its latest accepted value.
      flag(toggle,'checked',accepted);});
    let accepted=node.props.checked;
    return {update(next){if(next.kind!=='Toggle'&&next.kind!=='Checkbox')return;accepted=next.props.checked;controller.update(toggleProps(next));flag(toggle,'checked',accepted);flag(toggle,'disabled',!!next.props.disabled);
      attribute(toggle,'label',next.kind==='Checkbox'?next.props.text:next.props.a11y?.label);},focus(){toggle.shadowRoot!.querySelector('input')!.focus();},dispose(){controller.dispose();}};
  }
  if (node.kind === 'Select' || node.kind === 'Tabs') {
    const select=host as HYSelect|HYTabs;
    if(select instanceof HYTabs)select.controlled=true;
    const controller=new HYSelectionController(node.key,node.props,emit);
    let previous: HYSelectionProps|undefined;
    controller.attach({
      apply(props){
        if(!previous || !!props.disabled!==!!previous.disabled || !equalData(props.options,previous.options))
          select.options=props.options.map(option=>({...option,disabled:!!option.disabled||!!props.disabled}));
        if(select.value!==props.value)select.value=props.value;
        if(select instanceof HYSelect)flag(select,'disabled',!!props.disabled);
        attribute(select,'aria-disabled',props.disabled?'true':undefined);previous=props;
      },
      listen(callback){return listen(select,node.kind==='Select'?'value-change':'tab-change',event=>callback((event as CustomEvent<{value:string}>).detail.value,reason));},
    });
    // Keep the existing component's LTR behavior; mirror horizontal navigation only
    // for this adapter's RTL surface. Home/End retain their logical meanings.
    if(select instanceof HYTabs)listen(select,'keydown',event=>{
      const key=event as KeyboardEvent;
      if(!['ArrowLeft','ArrowRight'].includes(key.key)||getComputedStyle(select).direction!=='rtl')return;
      const button=key.composedPath()[0];
      if(!(button instanceof HTMLButtonElement)||button.getAttribute('role')!=='tab')return;
      const enabled=previous?.options.filter(option=>!option.disabled)??[];
      if(!enabled.length)return;
      key.preventDefault();key.stopImmediatePropagation();
      const position=enabled.findIndex(option=>option.value===button.dataset.value);
      const next=enabled[(position+(key.key==='ArrowLeft'?1:-1)+enabled.length)%enabled.length]!;
      controller.choose(next.value,'keyboard');
      const target=[...select.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')].find(item=>item.dataset.value===select.value);
      target?.focus();
    },true);
    return {update(next){if(next.kind==='Select'||next.kind==='Tabs')controller.update(next.props);},
      focus(){if(select instanceof HYSelect)select.shadowRoot!.querySelector('select')!.focus();else (select.shadowRoot!.querySelector<HTMLButtonElement>('button[tabindex="0"]')??select).focus();},
      dispose(){controller.dispose();}};
  }
  if (node.kind === 'TextInput' || node.kind === 'TextArea') return textControl(node,context,revision);
  if (node.kind === 'Slider') {
    const range=host as HYRange;range.controlled=true;
    const controller=new HYSliderController(node.key,node.props,emit);
    listen(range,'value-input',event=>controller.change((event as CustomEvent<{value:number}>).detail.value,reason));
    listen(range,'value-change',event=>{controller.change((event as CustomEvent<{value:number}>).detail.value,reason);controller.commit(reason);if(range.value!==controller.value)range.value=controller.value;});
    listen(range,'value-cancel',()=>{controller.cancel(reason);if(range.value!==controller.value)range.value=controller.value;});
    return {update(next){if(next.kind!=='Slider')return;controller.update(next.props);
      for(const field of ['min','max','step'] as const)attribute(range,field,String(next.props[field]));
      flag(range,'disabled',!!next.props.disabled);if(range.value!==next.props.value)range.value=next.props.value;},focus(){range.focus();},dispose(){controller.dispose();}};
  }
  if (node.kind === 'Dialog') {
    const dialog=host as HYDialog;dialog.controlled=true;
    let dismissible=node.props.dismissible!==false;
    listen(dialog,'dialog-cancel',event=>{event.preventDefault();const detail=(event as CustomEvent<{reason?:string}>).detail;
      if(!dismissible)return;
      emit({key:node.key,type:'cancel',reason:detail?.reason==='escape'?'keyboard':reason,transaction:++transaction});});
    return {update(next){if(next.kind!=='Dialog')return;dismissible=next.props.dismissible!==false;
      attribute(dialog,'heading',next.props.title);flag(dialog,'dismissible',dismissible);
      dialog.shadowRoot!.querySelector('button')!.style.display=dismissible?'':'none';},
      focus(){(focusable(dialog.shadowRoot!)[0]??dialog.shadowRoot!.querySelector('dialog')!).focus();},dispose(){dialog.open=false;}};
  }
  return undefined;
}

function textControl(node: Extract<HYNode,{kind:'TextInput'|'TextArea'}>,context: HYWebControlContext,revision:number): HYWebControl {
  const {host,listen,emit}=context;
  const input=host instanceof HYInput ? host.shadowRoot!.querySelector('input')! : host as HTMLTextAreaElement;
  const controller=new HYTextController(node.key,textProps(node),emit,node.kind==='TextArea',revision);
  let confirming=false,timer:ReturnType<typeof setTimeout>|undefined;
  controller.attach({apply(state){
    // Write the draft before attributes whose legacy sync method reads the value back.
    if(host instanceof HYInput){
      // Avoid the legacy public setter's unconditional native value assignment:
      // even assigning the same value can split the browser's undo typing group.
      attribute(host,'value',state.value);
      if(input.value!==state.value)input.value=state.value;
      attribute(host,'type',state.props.secure?'password':'text');
      flag(host,'disabled',!!state.props.disabled);flag(host,'readonly',!!state.props.readOnly);
      attribute(host,'placeholder',state.props.placeholder);
    }else{
      if(input.value!==state.value)input.value=state.value;
      input.disabled=!!state.props.disabled;input.readOnly=!!state.props.readOnly;
      attribute(input,'placeholder',state.props.placeholder);
    }
  }});
  // Let HYInput synchronize its native draft before our controlled view reads it.
  // A second attribute sync during the same native input breaks Chromium's undo grouping.
  listen(host,'input',()=>controller.input(input.value));
  listen(input,'compositionstart',()=>{if(timer)clearTimeout(timer);confirming=false;controller.compositionStart();});
  listen(input,'compositionend',()=>{confirming=true;controller.compositionEnd(input.value);timer=setTimeout(()=>{confirming=false;timer=undefined;},0);});
  listen(input,'keydown',event=>{const key=event as KeyboardEvent;if(key.key==='Enter')controller.enter(confirming||key.isComposing||key.keyCode===229);});
  // change is often dispatched before blur; both funnel through the controller's single active edit.
  listen(input,'change',()=>controller.commit());
  listen(input,'focus',()=>controller.focus());listen(input,'blur',()=>controller.blur());
  return {update(next,revision){if(next.kind==='TextInput'||next.kind==='TextArea')controller.update(textProps(next),revision);},focus(){input.focus({preventScroll:true});},
    dispose(){if(timer)clearTimeout(timer);controller.dispose();}};
}
function textProps(node: Extract<HYNode,{kind:'TextInput'|'TextArea'}>): HYTextProps {
  const {value,disabled,readOnly,placeholder}=node.props;
  return {value,...(disabled===undefined?{}:{disabled}),...(readOnly===undefined?{}:{readOnly}),...(placeholder===undefined?{}:{placeholder}),
    ...(node.kind==='TextInput'&&node.props.secure!==undefined?{secure:node.props.secure}:{})};
}
