
export interface ListIterator<T, TResult> {
    (value: T, index: number, list: T[]): TResult;
}

export function find<T>(t:T[],it:ListIterator<T,boolean>):T{
    return t.find(it);
}

export function filter<T>(t:T[],it:ListIterator<T,boolean>):T[]{
    return t.filter(it);
}
function uniques(arr) {

}
export function unique<T>(arr:T[]):T[]{
    var a = [];
    for (var i=0, l=arr.length; i<l; i++)
        if (a.indexOf(arr[i]) === -1 && arr[i])
            a.push(arr[i]);
    return a;
}

export function contains<T>(arr:T[],v:T):boolean{
    return arr.indexOf(v)!=-1;
}
export var uniq=unique


export function intersection<T>(arr:T[],arr1:T[]):T[]{
    var res:T[]=[];
    arr.forEach(x=>{
        if (contains(arr1,x)){
            res.push(x);
        }
    })
    return res;
}
export function isEqual(v:any,v1:any){
    return JSON.stringify(v)==JSON.stringify(v1);
}