declare module 'sql.js' {
  const initSqlJs: (options: { locateFile: (file: string) => string }) => Promise<unknown>;

  export default initSqlJs;
}
