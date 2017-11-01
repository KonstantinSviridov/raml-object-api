export interface Promise {
    then(instance: any, reject?: any): any;

    resolve(arg: any): any;
}

export interface IContentProvider {
    contextPath(): string;

    normalizePath(url: string): string;

    content(reference: string): string;

    hasAsyncRequests(): boolean;

    resolvePath(context: string, relativePath: string): string;

    isAbsolutePath(uri: string): boolean;

    contentAsync(arg: any): Promise;

    promiseResolve(arg: any): Promise;
}

class DummyProvider implements  IContentProvider {
    contextPath(): string {
        return "";
    }

    normalizePath(url: string): string {
        return "";
    }

    content(reference: string): string {
        return "";
    }

    hasAsyncRequests(): boolean {
        return false;
    }

    resolvePath(context: string, relativePath: string): string {
        return "";
    }

    isAbsolutePath(uri: string): boolean {
        return false;
    }

    contentAsync(reference: string): Promise {
        return {
            then: arg => arg(this.content(reference)),

            resolve: () => null
        };
    }

    promiseResolve(arg: any): Promise {
        return {
            then: arg1 => arg1(arg),

            resolve: () => null
        }
    }
}