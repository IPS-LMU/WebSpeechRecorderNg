// This Observer differs from RxJS Observer:
// - No sequence updates
// - Value is nullable

export interface Observer<T> {
  update(t:T|null): void
}
