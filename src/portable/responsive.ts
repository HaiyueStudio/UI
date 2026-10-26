/** Platform-independent logical-pixel layout decisions. */
export interface HYResponsiveGridOptions { readonly minCardWidth?:number; readonly maxColumns?:number; readonly gap?:number; }
export function hyResponsiveGrid(width:number, options:HYResponsiveGridOptions={}) {
  const {minCardWidth=260,maxColumns=4,gap=16}=options;
  if(!Number.isFinite(width)||width<0||!Number.isFinite(minCardWidth)||minCardWidth<=0||!Number.isInteger(maxColumns)||maxColumns<1||!Number.isFinite(gap)||gap<0)throw new RangeError('Invalid responsive grid dimensions');
  const columns=Math.max(1,Math.min(maxColumns,Math.floor((width+gap)/(minCardWidth+gap))));
  return Object.freeze({columns,gap,cardWidth:Math.max(0,(width-gap*(columns-1))/columns)});
}
export interface HYResponsiveWorkspaceOptions { readonly minPaneWidth?:number; readonly gap?:number; }
export function hyResponsiveWorkspace(width:number,height:number,options:HYResponsiveWorkspaceOptions={}) {
  const {minPaneWidth=420,gap=16}=options;
  if(![width,height,gap].every(v=>Number.isFinite(v)&&v>=0)||!Number.isFinite(minPaneWidth)||minPaneWidth<=0)throw new RangeError('Invalid responsive workspace dimensions');
  const split=width>=minPaneWidth*2+gap&&height>=420;
  return Object.freeze({split,gap,referenceHeight:Math.min(280,Math.max(0,height-120),Math.max(120,Math.round(height*.38)))});
}
