import {z} from 'zod';
/** Authentication errors are not service outages; never cache certificate responses. */
export function certificateAdminError(error:unknown){
 const reason=error instanceof Error?error.message:'';
 const code=error instanceof z.ZodError?'invalid_input':reason==='unauthorized'?'unauthorized':reason==='forbidden'?'forbidden':'unavailable';
 return Response.json({error:code},{status:code==='unauthorized'?401:code==='forbidden'?403:code==='invalid_input'?400:503,headers:{'Cache-Control':'no-store'}});
}
