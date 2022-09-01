import {
  BehaviorSubject,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
} from "rxjs";
import { distinctUntilChanged, map, pluck, take, tap } from "rxjs/operators";
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
export type ContextFactory<T, A = T[keyof T]> = {
  state$: Observable<T>;
  pick: <Result>(projector: Projector<Result, T>) => Observable<Result>;
  event: <Result>(projector: Projector<Result, T>) => Observable<Result>;
  pluck: <K extends keyof T>(key: K) => Observable<T[K]>;
  picker: PickerObj<T>;
  update: (a: UpdateFunction<T>) => void;
  updateP: <K extends Partial<T>>(partialState: K) => void;
  effect: <Type, Result, Rest = Result extends Observable<infer A> ? A : never>(
    effect: ProjectFunction<Type, Result>
  ) => (param: Type, returnFunc?: (p: Rest) => void) => Observable<Rest>;
  destroy: () => void;
  loading$: Observable<boolean>;
  startLoading: () => void;
  stopLoading: () => void;
  error$: Observable<Error | null>;
  emitError: (e: Error) => Observable<Error>;
  clearError: () => void;
};
export function createContextFactory<T, D = void>(
  contextDefinition: ContextDefinition<T>
): ContextFactory<T> {
  const { initialState, autoLoading = true, log = false } = contextDefinition;
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
    if (enableLog) console.log("%cUpdate", style, context.value);
    context.next(updateFunction(context.value));
  };
  //Update Partial Method
  const updatePImpl =
    <K extends Partial<T>>(partialState: K) =>
    (state: T) => ({ ...state, ...partialState });
  const updateP = <K extends Partial<T>>(partialState: K) =>
    update(updatePImpl(partialState));
  //Effect method -
  /*** Result is the observable with the ending value of the observable created in the effect ***/
  /*** Rest is the type value of that observable ***/
  const effect = <
    Type,
    Result,
    Rest = Result extends Observable<infer A> ? A : never
  >(
    effect: ProjectFunction<Type, Result>
  ): ((param: Type, returnFunc?: (p: Rest) => void) => Observable<Rest>) => {
    //Effect create parameter observable
    const effectSubject = new Subject<Type>();
    const effectObservable = effectSubject.asObservable();
    //Effect return
    const effectReturnSubject = new Subject<Rest>();
    const effectReturn$ = effectReturnSubject.asObservable();
    //Observable returned by the created effect by the user
    const returnValue = effect(effectObservable);
    const returnFunction = <Observable<Rest>>(<unknown>returnValue);
    const finalizeEffect = () => {
      if (autoLoading) loading.next(false);
      if (enableLog) console.groupEnd();
    };
    subscriptions.push(
      returnFunction.subscribe((value) => {
        finalizeEffect();
        effectReturnSubject.next(value);
      })
    );
    effectSubjects.push(effectSubject);
    //Effect method to call
    return (param: Type, returnFunc?: (p: Rest) => void): Observable<Rest> => {
      if (enableLog) logEffect();
      if (autoLoading) loading.next(true);
      //Run return function if created as parameter
      if (returnFunc) {
        effectReturn$.pipe(take(1)).subscribe((v) => {
          if (v instanceof Error || v instanceof TypeError) return;
          returnFunc(v);
        });
      }
      //Fire the effect with the passed parameter
      effectSubject.next(param);
      //Return the observable to use it if needed.
      return effectReturn$;
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
    updateP,
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
