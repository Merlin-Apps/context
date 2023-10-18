import { BehaviorSubject, Observable } from "rxjs";

interface CreateErrors {
  errors$: Observable<(Error | null)[]>;
  errorsValue: () => (Error | null)[];
  registerError: () => number;
  getError: (index: number) => Error | null;
  setError: (index: number, e: Error) => void;
  clearError: (index: number) => void;
  clearAllErrors: () => void;
}

export const createErrors = (): CreateErrors => {
  const errors = new BehaviorSubject<(Error | null)[]>([]);
  const errors$ = errors.asObservable();

  const registerError = (): number => {
    const currentErrors = [...errors.value];
    const index = currentErrors.push(null) - 1;
    errors.next(currentErrors);
    return index;
  };

  //Not used
  const getError = (index: number): Error | null => {
    return errors.value[index] ?? null;
  };

  const errorsValue = () => errors.value;

  const setError = (index: number, e: Error): void => {
    const currentErrors = [...errors.value];
    currentErrors[index] = e;
    errors.next(currentErrors);
  };

  const clearError = (index: number): void => {
    const currentErrors = [...errors.value];
    currentErrors[index] = null;
    errors.next(currentErrors);
  };

  const clearAllErrors = (): void => {
    const clearedErrors = errors.value.map(() => null);
    errors.next(clearedErrors);
  };

  return {
    errors$,
    errorsValue,
    registerError,
    getError,
    setError,
    clearError,
    clearAllErrors,
  };
};
