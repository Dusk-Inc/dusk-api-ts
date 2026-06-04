import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from "./context.js";
import type { RequestContext } from "../contracts/index.js";

export const traceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const headerId = req.headers['x-correlation-id'];
  const correlationId = typeof headerId === 'string' ? headerId : uuidv4();
    
  res.setHeader('x-correlation-id', correlationId);
  
  const context: RequestContext = { correlationId };
  
  storage.run(context, () => {
    next();
  });
};
