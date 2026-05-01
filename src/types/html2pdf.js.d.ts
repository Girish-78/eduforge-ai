declare module "html2pdf.js" {
  const html2pdf: () => {
    set: (options: Record<string, unknown>) => {
      from: (source: HTMLElement) => {
        toPdf: () => {
          get: (
            key: "pdf",
            callback?: (pdf: {
              internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } };
              setPage: (pageNumber: number) => void;
              setFontSize: (size: number) => void;
              setTextColor: (r: number, g: number, b: number) => void;
              text: (text: string, x: number, y: number, options?: { align?: string }) => void;
              save: (filename?: string) => void;
            }) => void | Promise<void>,
          ) => Promise<void>;
          save: () => Promise<void>;
        };
        save: () => Promise<void>;
      };
    };
  };

  export default html2pdf;
}
