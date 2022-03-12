import express from "express"
import jwt from 'jsonwebtoken'
import { Snowflake } from "nodejs-snowflake"
import { UserModel } from "./schemas"

export function rAsync (route: (req: express.Request, res: express.Response, next?: express.NextFunction) => {}) {
  function out(req: express.Request, res: express.Response, next: express.NextFunction) {
    try { route(req, res, next) } catch (err: any) {
      next(err)
    }
  }
  return out
}

export function GenerateUUID () {
  return new Snowflake({
    custom_epoch: 1646976441877
  }).getUniqueID();
}

export function VerifySessionToken (authorization?: string): string | null {
  var user_id: string | null = null;
  jwt.verify(authorization || "", process.env.SESSION_TOKEN_SECRET as any, (err: any, data: any) => {
    if (err) return;
    const user = UserModel.findOne({ id: data.id }).exec()
    if (!user) return user_id = null;
    else user_id = data.id;
  })
  return user_id;
}

/**
 * @description Removes unused/unwanted fields from an object
 * @param object Object to filter
 * @param predicate Custom filter function (Optional)
 * @returns Filtered object
 */
export function FilterObject (object: Object | Array<any>, predicate?: (value: any) => boolean) {
  const obj: any = object;
  var out: any;

  if (Array.isArray(obj)) {
    out = [];
    for (const value of obj) {
      if (predicate && !predicate(value)) {}
      else if ([null, undefined].includes(value)) {} 
      else if (typeof value === "object") out.push(FilterObject(obj, predicate));
      else out.push(value);
    }
  } else {
    out = {};
    for (const key in obj) {
      if (predicate && !predicate(obj[key])) {}
      else if ([null, undefined].includes(obj[key])) {} 
      else if (typeof obj[key] === "object") out[key] = FilterObject(obj, predicate);
      else out[key] = obj[key];
    }
  }

  return out
}