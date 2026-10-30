/** Scroll only the message pane. scrollIntoView can also scroll hidden ancestors. */
export function scrollMessagePane(end:HTMLElement|null,behavior:ScrollBehavior='auto'){
 const pane=end?.closest<HTMLElement>('[data-message-stream]');
 if(pane)pane.scrollTo({top:pane.scrollHeight,behavior});
}
