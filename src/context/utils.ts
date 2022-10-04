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
