declare module 'piper-phonemize' {
  export interface PiperPhonemizeModule {
    callMain: (args: string[]) => void;
  }

  export function createPiperPhonemize(options: {
    print?: (data: string) => void;
    printErr?: (message: string) => void;
    locateFile?: (url: string) => string;
  }): Promise<PiperPhonemizeModule>;
}
