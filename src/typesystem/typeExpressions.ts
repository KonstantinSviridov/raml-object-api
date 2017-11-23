import ts=require("./typesystem")
import schemaUtil = require('./schemaUtil')
import {ComponentShouldBeOfType} from "./restrictions";
import {ParseNode} from "./parse";
import typeExpressionDefs = require("raml-typeexpressions-parser")
import meta = require("./metainfo");

export type BaseNode = typeExpressionDefs.BaseNode;
export type Union = typeExpressionDefs.Union;
export type Literal = typeExpressionDefs.Literal;
export type Parens = typeExpressionDefs.Parens;


export function parseToType(val:string,t:ts.TypeRegistry, contentProvidingNode?:ParseNode,
    typeAttributeContentProvider: schemaUtil.IContentProvider = null):ts.AbstractType{
    if(val==null){
        return null;
    }
    try {

        var q=val.trim();
        
        if (q.length > 0) {
            var json=q.charAt(0)=='{';
            if (json || (q.charAt(0)=='<'&&q.length>1&&q.charAt(1)!='<')){

                let typeChild = contentProvidingNode;
                let n:ParseNode;
                let schemaPath:string;
                let sPathNode = contentProvidingNode.childWithKey("schemaPath");
                if(sPathNode){
                    schemaPath = sPathNode.value();
                }
                do {
                    n = typeChild;
                    typeChild = n.childWithKey("type");
                }
                while(typeChild);

                let contentProvider: schemaUtil.IContentProvider =
                    n && (<any>n).contentProvider && (<any>n).contentProvider();
                const result = new ts.ExternalType("", q, json, contentProvider, typeAttributeContentProvider);
                if(schemaPath){
                    result.addMeta(new meta.SchemaPath(schemaPath));
                }
                return result;
            }

            var node:BaseNode = parse(val);
            var result= parseNode(node, t);
            return result;    
        } else {
            return ts.derive(val,[ts.STRING])
        }
        
        
    } catch (e){
        return ts.derive(val,[ts.UNKNOWN]);
    }
}

function wrapArray(a:number, result:ts.AbstractType):ts.AbstractType {
    while (a > 0) {
        var nt = ts.derive("", [ts.ARRAY]);
        nt.addMeta(new ComponentShouldBeOfType(result));
        result = nt;
        a--;
    }
    return result;
}
function parseNode(node:BaseNode,t:ts.TypeRegistry):ts.AbstractType
{
    if (node.type=="union"){
        var ut=<Union>node;
        return ts.union("",[parseNode(ut.first,t),parseNode(ut.rest,t)]);
    }
    else if (node.type=="parens"){
        var ps=<Parens>node;
        var rs=parseNode(ps.expr,t);
        return wrapArray(ps.arr,rs);
    }
    else{
        var lit=(<Literal>node);
        if (lit.value.charAt(lit.value.length-1)=='?'){
            var result=t.get(lit.value.substr(0,lit.value.length-1));
            if (!result){
                result=ts.derive(lit.value,[ts.UNKNOWN]);
            }
            result=ts.union(lit.value,[result,ts.NIL]);
            var a=lit.arr;
            return wrapArray(a, result);
        }
        var result=t.get(lit.value);
        if (!result){
            result=ts.derive(lit.value,[ts.UNKNOWN]);
        }
        var a=lit.arr;
        return wrapArray(a, result);
    }
}


export function storeToString(t:ts.AbstractType):string{
    if (t.isSubTypeOf(ts.ARRAY)){
        var cm=t.oneMeta(ComponentShouldBeOfType);
        if (cm) {
            if (cm.value().isUnion()) {
                return "(" + storeToString(cm.value()) + ")" + "[]";

            }
            else return storeToString(cm.value()) + "[]";
        }
        return "array";
    }
    if (t instanceof ts.UnionType){
        var ut= <ts.UnionType>t;
        return ut.options().map(x=>storeToString(x)).join(" | ");
    }
    if (t.isAnonymous()){
        if (t.isEmpty()){
            return t.superTypes().map(x=>storeToString(x)).join(" , ");
        }
    }
    return t.name();
}


export function parse(str:string):BaseNode{
    let result = typeExpressionDefs.parse(str);
    result = checkNil(result);
    return result;
}

function checkNil(node:BaseNode):BaseNode{
    if(node.type=="name"){
        const lit = <Literal>node;
        const value = lit.value;
        if(value && value.length && value.charAt(value.length-1)=="?"){
            let rValue = value.substring(0,value.length-1);
            let rExpr = parse(rValue);
            let result:BaseNode = <Union>{
                type: "union",
                first: rExpr,
                rest: {
                    type: "name",
                    value: "nil"
                }
            };
            if(typeof lit.arr === "number" && lit.arr >0){
                result = <Parens>{
                    type: "parens",
                    expr: result,
                    arr: lit.arr
                }
            }
            return result;
        }
        else{
            return lit;
        }
    }
    else if(node.type=="union"){
        const union = (<Union>node);
        union.first = checkNil(union.first);
        union.rest = checkNil(union.rest);
    }
    else if(node.type=="parens"){
        const parens = (<Parens>node);
        parens.expr = checkNil(parens.expr);
    }
    return node;
}