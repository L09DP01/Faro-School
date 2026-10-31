/** Provider model IDs and standard token estimates, checked against provider docs 2026-10-31. */
export const GEMINI_ASSISTANT_MODEL='gemini-3.5-flash-lite';
export const CLAUDE_ASSISTANT_MODEL='claude-haiku-5-5';
export const ASSISTANT_MODELS=[GEMINI_ASSISTANT_MODEL,CLAUDE_ASSISTANT_MODEL] as const;
export function assistantModel(configured:string|undefined,gemini:boolean,anthropic:boolean){
 if(!configured)return gemini?GEMINI_ASSISTANT_MODEL:CLAUDE_ASSISTANT_MODEL;
 if(['gemini-1.5-flash','gemini-1.5-flash-latest'].includes(configured))return GEMINI_ASSISTANT_MODEL;
 if(['claude-3-haiku-20240307','claude-3-5-sonnet-20241022'].includes(configured))return anthropic?CLAUDE_ASSISTANT_MODEL:gemini?GEMINI_ASSISTANT_MODEL:CLAUDE_ASSISTANT_MODEL;
 return configured;
}
export function assistantCost(model:string,input:number,output:number){
 if(model===GEMINI_ASSISTANT_MODEL)return(input*0.30+output*2.50)/1000000;
 if(model===CLAUDE_ASSISTANT_MODEL){const large=input>100000;return(input*(large?0.50:0.10)+output*(large?2.50:0.50))/1000000;}
 return null;
}
