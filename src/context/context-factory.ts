import { createLoadings } from "./loadings";
import {
  BehaviorSubject,
  from,
  Observable,
  of,
  pipe,
  ReplaySubject,
  Subject,
  Subscription,
  throwError,
} from "rxjs";
import {
  catchError,
  concatMap,
  distinctUntilChanged,
  exhaustMap,
  map,
  mergeMap,
  retry,
  switchMap,
  take,
  tap,
} from "rxjs/operators";
import { logEffect } from "./proxy-logger";
import { operationOb, UUID } from "./utils";
import { createErrors } from "./errors";

export type ContextDefinition<T> = {
  initialState: T;
  autoLoading?: boolean;
  log?: boolean;
};

//Options for Context configuration
export type ContextConfig = {
  autoLoading?: boolean; //Enable auto-loading for effects (default false)
  log: boolean; //Enable log (set true default only in development mode)
};
//For Update function
export type UpdateFunction<T> = (state: T) => T;
//For Pick function
export type Projector<Result, T> = (s: T) => Result;
//For get all Pickers
export type PickerObj<T> = {
  [P in keyof T as `${string & P}$`]: Observable<T[P]>;
};
export type StateObj<T> = {
  [P in keyof T as `${string & P}`]: T[P];
};

export type ReturnTriggerT<T> = Promise<T | void> | T | void;
//`${Extract<keyof T, string>}$`

//For effect function
export type ProjectFunction<Type, Result> = (type$: Observable<Type>) => Result;
export type ContextFactory<T, Success = string> = {
  state$: Observable<T>;
  readonly value: T;
  pick: <Result>(projector: Projector<Result, T>) => Observable<Result>;
  pluck: <K extends keyof T>(key: K) => Observable<T[K]>;
  picker: PickerObj<T>;
  update: (a: UpdateFunction<T>) => void;
  patch: <K extends Partial<T>>(partialState: K) => void;
  effect: <Type, Result, Rest = Result extends Observable<infer A> ? A : never>(
    effect: ProjectFunction<Type, Result>
  ) => (
    param: Type,
    returnFunc?: (p: Rest) => void,
    returnError?: (p: Error) => void
  ) => Observable<Rest>;
  destroy: () => void;
  loading$: Observable<boolean>;
  errors$: Observable<(Error | null)[]>;
  errors: (Error | null)[];
  clearError: (index: number) => void;
  clearAllErrors: () => void;
  asyncEffect: <ParamTypes, H>({
    trigger,
    success,
    error,
    operation,
  }: {
    trigger: (params: ParamTypes) => Observable<H>;
    success?: (info: { params: ParamTypes; data: H }) => void;
    error?: (info: { e: Error; params: ParamTypes }) => void;
    operation?: "switch" | "reject" | "concat" | "merge";
  }) => {
    run: (
      params: ParamTypes,
      functions?: {
        onSuccess?: (p: H) => void;
        onError?: (e: Error) => void;
      }
    ) => Observable<H>;
  };
};
export function createContextFactory<T, Success = string>(
  initialState: T,
  config: ContextConfig = { autoLoading: true, log: false }
): ContextFactory<T> {
  const { autoLoading, log } = config;
  /*** INITIALIZATION ***/
  //Enable log
  const enableLog = log;
  //Style for console.log
  const style = "font-weight:bold;";
  //Effects and subscriptions
  const effectSubjects: Subject<any>[] = [];
  const subscriptions: Subscription[] = [];
  //Context subject and state
  const context = new BehaviorSubject(initialState);
  const state$ = context.asObservable();
  //Manage auto-loading
  const {
    loading$,
    registerLoading,
    startLoading,
    stopLoading,
    destroyLoading,
  } = createLoadings();
  const loadingLog$ = loading$.pipe(
    tap((value) => enableLog && console.log("%cLoading", style, value))
  );
  const loadingSub = loadingLog$.subscribe();
  subscriptions.push(loadingSub);
  //Manage auto-error catch for effects
  const {
    errors$,
    errorsValue,
    registerError,
    setError,
    clearError,
    clearAllErrors,
    destroyErrors,
  } = createErrors();

  //Log initial state
  if (enableLog) console.log("%cInit Context", style, initialState);
  /*** MAIN METHODS ***/
  //Pick method
  const pick = <Result>(
    mapFunction: Projector<Result, T>
  ): Observable<Result> =>
    state$.pipe(map(mapFunction), distinctUntilChanged());
  //Pick method
  const event = <Result>(
    mapFunction: Projector<Result, T>
  ): Observable<Result> => state$.pipe(map(mapFunction));

  //Pluck method
  const pluckImp =
    <T, K extends keyof T>(key: K) =>
    (state: T) =>
      state[key];
  const pluckContext = <K extends keyof T>(key: K) => pick(pluckImp(key));

  const pluckAll = <K extends keyof T>() => {
    // type PluckKey = { [P in `${Extract<keyof T, string>}$`]: string };
    const pluckObj: PickerObj<T> = {} as any;

    Object.keys(initialState).forEach((key: string) => {
      const pluck$ = pluckContext(<K>key);
      const descriptor = {
        enumerable: true,
        configurable: true,
        writable: false,
        value: pluck$,
      };
      Object.defineProperty(pluckObj, key + "$", descriptor);
    });

    return pluckObj;
  };

  const picker = pluckAll();

  const value = () => context.value;

  //Update method
  const update = (updateFunction: UpdateFunction<T>): void => {
    const updatedState = updateFunction(context.value);
    //Verify that the updated state produces the same keys as the initial state
    const currentKeys = Object.keys(initialState);
    const updatedKeys = Object.keys(updatedState);
    let diffKey = [];

    updatedKeys.forEach((key) => {
      if (!currentKeys.includes(key)) diffKey.push(key);
    });

    //Only check because user can add new keys, not less or repeat one (typescript checks for us)
    if (currentKeys.length !== updatedKeys.length) {
      throw new Error(
        `The key/keys ${diffKey.toString()} is/are not defined in the State of the context.`
      );
    }

    if (enableLog) {
      console.log("%cUpdate", style, updatedState);
      logEffect();
      console.trace();
    }
    context.next(updatedState);
  };
  //Update Partial Method
  const patchImpl =
    <K extends Partial<T>>(partialState: K) =>
    (state: T) => ({ ...state, ...partialState });

  const patch = <K extends Partial<T>>(partialState: K) =>
    update(patchImpl(partialState));
  //Effect method -
  /*** Result is the observable with the ending value of the observable created in the effect ***/
  /*** Rest is the type value of that observable ***/
  const effect = <
    Type,
    Result,
    Rest = Result extends Observable<infer A> ? A : never
  >(
    trigger: ProjectFunction<Type, Result>
  ): ((
    param: Type,
    returnFunc?: (p: Rest) => void,
    returnError?: (p: Error) => void
  ) => Observable<Rest>) => {
    //Effect create parameter observable
    const effectSubject = new Subject<Type>();
    const effectObservable = effectSubject.asObservable();
    //Effect success return
    const effectSuccessSubject = new Subject<Rest>();
    const effectSucess$ = effectSuccessSubject.asObservable();
    //Effect error return
    const effectErrorSubject = new Subject<Error>();
    const effectError$ = effectErrorSubject.asObservable();
    //Observable returned by the created effect by the user
    const returnValue = trigger(effectObservable);
    const returnFunction = <Observable<Rest>>(<unknown>returnValue);

    const effectId = UUID();
    registerLoading(effectId);
    const efffectIndex = registerError();

    const finalizeEffect = () => {
      if (autoLoading) {
        stopLoading(effectId);
      }
      if (enableLog) {
        console.groupEnd();
      }
    };

    let returnObsSubject = new ReplaySubject<Rest>(1);
    let returnObs$ = returnObsSubject.asObservable();
    //Subscribe once to the trigger observable created by the user

    const createReturnObs = () => {
      const sub = returnFunction
        .pipe(
          tap((value) => {
            finalizeEffect();
            setError(efffectIndex, null);
            effectSuccessSubject.next(value);
            returnObsSubject.next(value);
          }),
          catchError((e) => {
            finalizeEffect();
            effectErrorSubject.next(e);
            setError(efffectIndex, e);
            returnObsSubject.error(e);
            //Stop throw error propagation
            return of(e);
          })
        )
        .subscribe();
      returnObsSubject = new ReplaySubject<Rest>(1);
      returnObs$ = returnObsSubject.asObservable();
      effectSubjects.push(returnObsSubject);
      return sub;
    };
    let returnObsSubscription = createReturnObs();
    subscriptions.push(returnObsSubscription);

    effectSubjects.push(effectSubject);
    effectSubjects.push(effectSuccessSubject);
    effectSubjects.push(effectErrorSubject);
    effectSubjects.push(returnObsSubject);
    //Effect method to call
    return (
      param: Type,
      returnFunc?: (p: Rest) => void,
      returnError?: (e: Error) => void
    ): Observable<Rest> => {
      if (returnObsSubscription.closed) {
        returnObsSubscription = createReturnObs();
        subscriptions.push(returnObsSubscription);
      }

      if (enableLog) logEffect();
      if (autoLoading) startLoading(effectId);

      //Run return function if created as parameter
      if (returnFunc) {
        effectSucess$.pipe(take(1)).subscribe((v) => {
          returnFunc(v);
        });
      }
      //Run the error function if created as parameter
      if (returnError) {
        effectError$.pipe(take(1)).subscribe((v) => {
          returnError(v);
        });
      }

      //Fire the effect with the passed parameter
      effectSubject.next(param);

      //Return the observable to use it, if needed.
      return returnObs$;
    };
  };

  //Clean the context
  const destroy = () => {
    effectSubjects.forEach((effect) => {
      effect.complete();
    });
    subscriptions.forEach((sub) => !sub.closed && sub.unsubscribe());
    destroyLoading();
    destroyErrors();
  };

  //Type,
  // Result,
  // Rest = Result extends Observable<infer A> ? A : never
  //Create effect
  const asyncEffect = <ParamsType, H>({
    trigger,
    success,
    error,
    operation,
  }: {
    trigger: (params: ParamsType) => Observable<H>;
    success?: (info: { params: ParamsType; data: H }) => void;
    error?: (info: { e: Error; params: ParamsType }) => void;
    operation?: "switch" | "reject" | "concat" | "merge";
  }): {
    run: (
      params: ParamsType,
      functions?: {
        onSuccess?: (p: H) => void;
        onError?: (e: Error) => void;
      }
    ) => Observable<H>;
  } => {
    const apiCallFn = (params: ParamsType) =>
      trigger(params).pipe(
        tap((data) => {
          if (success) {
            success({ params, data });
          }
        }),
        catchError((e: Error) => {
          if (error) {
            error({ e, params });
          }
          return throwError(e);
        })
      );

    //Switch
    let effectCreated = effect((trigger$: Observable<ParamsType>) =>
      trigger$.pipe(switchMap(apiCallFn))
    );

    //Concat
    if (operation === "concat") {
      effectCreated = effect((trigger$: Observable<ParamsType>) =>
        trigger$.pipe(concatMap(apiCallFn))
      );
    }

    //Merge
    if (operation === "merge") {
      effectCreated = effect((trigger$: Observable<ParamsType>) =>
        trigger$.pipe(mergeMap(apiCallFn))
      );
    }

    //Reject
    if (operation === "reject") {
      effectCreated = effect((trigger$: Observable<ParamsType>) =>
        trigger$.pipe(exhaustMap(apiCallFn))
      );
    }

    return {
      run: (params: ParamsType, functions) => {
        const { onSuccess, onError } = functions ?? {
          onSuccess: () => {},
          onError: () => {},
        };

        return effectCreated(params, onSuccess, onError);
      },
    };
  };

  effectSubjects.push(context);

  return {
    state$,
    pick,
    get value() {
      return value();
    },
    pluck: pluckContext,
    picker,
    update,
    patch,
    effect,
    asyncEffect,
    destroy,
    loading$,
    errors$,
    get errors() {
      return errorsValue();
    },
    clearError,
    clearAllErrors,
  };
}

function fireEffect<H>(
  apiCall: Observable<H>,
  cb: (data: H) => void,
  results?: { success?: string; error?: string }
): Observable<H> {
  const pipeCb = cb ? pipe(tap(cb)) : pipe(tap(() => {}));

  return apiCall.pipe(
    pipeCb,
    tap((data: any) =>
      this.update((state) => ({ ...state, success: results?.success }))
    ),
    catchError((e) => {
      this.emitError(e);
      return of(e);
    })
  );
}

// //Async effect as Promise
// const asyncEffect = <P, Success = string>(
//   trigger: (params: P) => Promise<Success | void>,
//   error?: (params: P) => string,
//   operation?: "switch" | "reject" | "concat" | "merge"
// ) => {
//   let cachedError: string;
//   const cb: (params: P) => Observable<Success | void> = (params: P) => {
//     cachedError = error ? error(params) : "";
//     return from(trigger(params));
//   };

//   const runMessagePipe = pipe(
//     tap((success: Success | void) => console.log("Success Msg", success)),
//     catchError((e) => {
//       console.log("Error Msg", cachedError);
//       emitError(e);
//       return of(e);
//     })
//   );

//   const projector = (triggerParams$: Observable<P>) =>
//     triggerParams$.pipe(operationOb(cb, operation), runMessagePipe);
//   return effect(projector);
// };

// //TODO: Make cb optional, cb could be managed by user in the apiCall Observable
// function createAsyncEffect<P, H>(
//   trigger: (params: P) => {
//     apiCall: Observable<H>;
//     cb: (data: H) => void;
//     success?: string;
//     error: string;
//   },
//   operation?: "switch" | "reject" | "concat" | "merge"
// ) {
//   const cb: (params: P) => {
//     apiCall: Observable<H>;
//     cb: (data: H) => void;
//     success?: string;
//     error: string;
//   } = (params: P) => trigger(params);

//   const innerCb = ({
//     apiCall,
//     cb,
//     error,
//     success,
//   }: {
//     apiCall: Observable<H>;
//     cb: (data: H) => void;
//     success?: string;
//     error: string;
//   }) => this.fireEffect(apiCall, cb, { success, error });

//   const projector = (triggerParams$: Observable<P>) =>
//     triggerParams$.pipe(map(cb), this.innerCbOperation(innerCb, operation));

//   return this.effect(projector);
// }
