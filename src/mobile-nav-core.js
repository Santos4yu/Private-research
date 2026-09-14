// Hysteresis prevents tiny scroll movements from toggling the dock.
export function dockHiddenAt(scrollY,wasHidden=false){
 const y=Math.max(0,Number(scrollY)||0);
 return wasHidden ? y>2 : y>18;
}
