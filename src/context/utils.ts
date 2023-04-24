import { Observable } from "rxjs";
import { concatMap, exhaustMap, mergeMap, switchMap } from "rxjs/operators";

//Generate UUID
function random4(): string {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}

export function UUID(): string {
  return (
    random4() +
    random4() +
    random4() +
    random4() +
    random4() +
    random4() +
    random4() +
    random4()
  );
}

export function operationOb<P, Success = string>(
  cb: (params: P) => Observable<Success | void>,
  operation?: "switch" | "reject" | "concat" | "merge"
) {
  switch (operation) {
    case "switch": {
      return switchMap(cb);
    }
    case "reject": {
      return exhaustMap(cb);
    }
    case "concat": {
      return concatMap(cb);
    }
    case "merge": {
      return mergeMap(cb);
    }
    //Fallback always to switchMap
    default: {
      return switchMap(cb);
    }
  }
}

export function innerCbOperation<H>(
  cb: (params: {
    apiCall: Observable<H>;
    cb: (data: H) => void;
    success?: string;
    error: string;
  }) => Observable<H>,
  operation?: "switch" | "reject" | "concat" | "merge"
) {
  switch (operation) {
    case "switch": {
      return switchMap(cb);
    }
    case "reject": {
      return exhaustMap(cb);
    }
    case "concat": {
      return concatMap(cb);
    }
    case "merge": {
      return mergeMap(cb);
    }
    //Fallback always to switchMap
    default: {
      return switchMap(cb);
    }
  }
}
