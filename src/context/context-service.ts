// import createContextFactory, {
//   ContextConfig,
//   ContextDefinition,
//   ContextFactory,
//   PickerObj,
//   ProjectFunction,
//   Projector,
//   UpdateFunction,
// } from './context-factory';
// import { Inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
// import { Observable, Subject } from 'rxjs';

// export declare const CONTEXT_DEFINITION_TOKEN: InjectionToken<unknown>;
// export declare const INITIAL_STATE_TOKEN: InjectionToken<unknown>;
// export declare const CONFIG_CONTEXT_TOKEN: InjectionToken<unknown>;
// @Injectable()
// export class ContextService<T, D = void> implements OnDestroy {
//   protected context: ContextFactory<T, D> = createContextFactory(
//     this.contextDefinition,
//   );
//   protected pick: <Result>(
//     projector: Projector<Result, T>,
//   ) => Observable<Result>;
//   protected event: <Result>(
//     projector: Projector<Result, T>,
//   ) => Observable<Result>;
//   protected pluck: <K extends keyof T>(key: K) => Observable<T[K]>;
//   picker: PickerObj<T>;
//   protected effect: <
//     Type,
//     Result,
//     Rest = Result extends Observable<infer A> ? A : never,
//   >(
//     effect: ProjectFunction<Type, Result>,
//   ) => (param: Type, returnFunc?: (p: Rest) => void) => Observable<Rest>;
//   protected update: (a: UpdateFunction<T>) => void;
//   updateP: <K extends Partial<T>>(partialState: K) => void;
//   protected state$: Observable<T>;
//   loading$: Observable<boolean>;
//   protected startLoading: () => void;
//   protected stopLoading: () => void;
//   error$: Observable<Error | null>;
//   protected emitError: (e: Error) => Observable<Error>;
//   clearError: () => void;
//   protected unsubscribe = new Subject();
//   constructor(
//     @Inject(CONTEXT_DEFINITION_TOKEN)
//     private contextDefinition: ContextDefinition<T>,
//   ) {
//     this.pick = this.context.pick;
//     this.pluck = this.context.pluck;
//     this.event = this.context.event;
//     this.picker = this.context.picker;
//     this.update = this.context.update;
//     this.updateP = this.context.updateP;
//     this.effect = this.context.effect;
//     this.state$ = this.context.state$;
//     this.loading$ = this.context.loading$;
//     this.startLoading = this.context.startLoading;
//     this.stopLoading = this.context.stopLoading;
//     this.error$ = this.context.error$;
//     this.emitError = this.context.emitError;
//     this.clearError = this.context.clearError;
//   }
//   ngOnDestroy() {
//     this.unsubscribe.next(null);
//     this.unsubscribe.complete();
//     this.context.destroy();
//   }
// }
