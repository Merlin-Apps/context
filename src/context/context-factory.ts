import {
  AsyncSubject,
  BehaviorSubject,
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
} from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  first,
  last,
  map,
  pluck,
  switchMap,
  take,
  tap,
} from "rxjs/operators";
import { logEffect } from "./proxy-logger";

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

//`${Extract<keyof T, string>}$`

//For effect function
export type ProjectFunction<Type, Result> = (type$: Observable<Type>) => Result;
export type ContextFactory<T> = {
  state$: Observable<T>;
  pick: <Result>(projector: Projector<Result, T>) => Observable<Result>;
  event: <Result>(projector: Projector<Result, T>) => Observable<Result>;
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
  startLoading: () => void;
  stopLoading: () => void;
  error$: Observable<Error | null>;
  emitError: (e: Error) => Observable<Error>;
  clearError: () => void;
};
export function createContextFactory<T>(
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
  const loading = new ReplaySubject<boolean>(1);
  const loadingLog$ = loading
    .asObservable()
    .pipe(tap((value) => enableLog && console.log("%cLoading", style, value)));
  const loading$ = loading.asObservable();
  //Loading methods
  const startLoading = () => loading.next(true);
  const stopLoading = () => loading.next(false);
  const loadingSub = loadingLog$.subscribe();
  subscriptions.push(loadingSub);
  //Manage auto-error catch for effects
  const error = new BehaviorSubject<Error | null>(null);
  const error$ = error.asObservable();
  const sendError = (e: Error): void => {
    error.next(e);
  };
  //Utilities for catchError on flattening maps
  const emitError = (e: Error): Observable<Error> => {
    sendError(e);
    return of(e);
  };

  const clearError = () => {
    error.next(null);
  };
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

    if (enableLog) console.log("%cUpdate", style, updatedState);
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

    const finalizeEffect = () => {
      if (autoLoading) loading.next(false);
      if (enableLog) console.groupEnd();
    };

    //TODO: Not sure if is neccessary (for destroy, complete effects)
    effectSubjects.push(effectSubject);
    //Effect method to call
    return (
      param: Type,
      returnFunc?: (p: Rest) => void,
      returnError?: (e: Error) => void
    ): Observable<Rest> => {
      if (enableLog) logEffect();
      if (autoLoading) loading.next(true);

      const returnObsSubject = new ReplaySubject<Rest>(1);
      const returnObs$ = returnObsSubject.asObservable();

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

      //Subscribe once to the trigger observable created by the user
      returnFunction
        .pipe(
          take(1),
          tap((value) => {
            finalizeEffect();
            effectSuccessSubject.next(value);
            returnObsSubject.next(value);
          }),
          catchError((e) => {
            finalizeEffect();
            effectErrorSubject.next(e);
            returnObsSubject.error(e);
            //Stop throw error propagation
            return of(e);
          })
        )
        .subscribe();

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
    subscriptions.forEach((sub) => sub.unsubscribe());
  };
  return {
    state$,
    pick,
    event,
    pluck: pluckContext,
    picker,
    update,
    patch,
    effect,
    destroy,
    loading$,
    startLoading,
    stopLoading,
    error$,
    emitError,
    clearError,
  };
}
