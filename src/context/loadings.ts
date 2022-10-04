import { BehaviorSubject, Observable } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

type LoadingRecord = Record<string, boolean>;
interface CreateLoading {
  loading$: Observable<boolean>;
  registerLoading: (id: string) => void;
  stopLoading: (id: string) => void;
  startLoading: (id: string) => void;
}

export const createLoadings = (): CreateLoading => {
  const loadings = new BehaviorSubject<LoadingRecord>({});
  const loading$ = loadings.asObservable().pipe(
    map((loadingMap) => Object.values(loadingMap).some((l) => l)),
    distinctUntilChanged()
  );

  const registerLoading = (id: string): void => {
    loadings.next({ ...loadings.value, [id]: false });
  };

  const stopLoading = (id: string): void => {
    loadings.next({ ...loadings.value, [id]: false });
  };

  const startLoading = (id: string): void => {
    loadings.next({ ...loadings.value, [id]: true });
  };

  return { loading$, registerLoading, stopLoading, startLoading };
};
