export import  ts=require("./typesystem");
var messageRegistry = ts.messageRegistry;
export import tsInterfaces = require("../typesystem-interfaces/typesystem-interfaces");

import  rs=require("./restrictions")
import {AbstractType} from "./typesystem";
import typeExpressions=require("./typeExpressions")
import facetR=require("./facetRegistry")
import meta=require("./metainfo")
import {Annotation, DiscriminatorValue, DisplayName, Example, Examples, Required} from "./metainfo";
import {Type} from "typescript";
import {FacetDeclaration} from "./metainfo";
import {HasProperty} from "./restrictions";
import {AdditionalPropertyIs} from "./restrictions";
import {MapPropertyIs} from "./restrictions";
import {TypeRegistry} from "./typesystem";
import {ComponentShouldBeOfType} from "./restrictions";
import su = require("./schemaUtil")
import {KnownPropertyRestriction} from "./restrictions";
import {IParsedTypeCollection} from "../typesystem-interfaces/typesystem-interfaces";
import _ = require("underscore");


export enum NodeKind{
    SCALAR,
    ARRAY,
    MAP
}

export interface ParseNode {

    key():string

    value():any

    children():ParseNode[];

    childWithKey(k:string):ParseNode;

    kind(): NodeKind

    anchor?():any
}

class JSObjectNode implements ParseNode{

    constructor(private _key:string,private obj:any,private inArr:boolean=false, private provider: su.IContentProvider){
    }

    value(){
        return this.obj;
    }

    key(){
        if (!this._key){
            if (this.kind()===NodeKind.MAP&&this.inArr){
                var l=Object.keys(this.obj);
                if (l.length===1){
                    return l[0];
                }
            }
        }
        return this._key;
    }
    childWithKey(k:string):ParseNode{
        if (this.obj==null){
            return null;
        }
        if (this.obj.hasOwnProperty(k)){
            return new JSObjectNode(k,this.obj[k], false, this.contentProvider());
        }
        return null;
    }

    children():JSObjectNode[]{
        if (Array.isArray(this.obj)){
            return (<any[]>this.obj).map(x=>new JSObjectNode(null,x,true, this.contentProvider()));
        }
        else if (this.obj&&typeof this.obj=="object"){
            return Object.keys(this.obj).map(x=>new JSObjectNode(x,this.obj[x], false, this.provider));
        }
        return []
    }
    kind():NodeKind{
        if (!this.obj){
            return NodeKind.SCALAR;
        }
        if (Array.isArray(this.obj)){
            return NodeKind.ARRAY;
        }
        else if (typeof this.obj==="object"){
            return NodeKind.MAP;
        }
        return NodeKind.SCALAR;
    }

    contentProvider(): su.IContentProvider {
        return this.provider;
    };
}
export function parseJSON(name: string,n:any,r:ts.TypeRegistry=ts.builtInRegistry(), provider?: su.IContentProvider):ts.AbstractType {
    var res= parse(name,new JSObjectNode(null,n, false, provider),r,null);


    return res;
}
export function parseJSONTypeCollection(n:any,r:ts.TypeRegistry=ts.builtInRegistry(), provider?: su.IContentProvider):TypeCollection {
    return parseTypeCollection(new JSObjectNode(null,n, false, provider),r);
}
function endsWithQuestionMark(p:string) {
    return p.charAt(p.length - 1) == '?';
}

export class PropertyBean{
    id: string
    optional: boolean
    additonal: boolean
    regExp: boolean;
    type: ts.AbstractType;
    annotations: {
        name: string,
        key: string
        value: any
    }[];

    add(t:ts.AbstractType){
        if (!this.optional&&!this.additonal&&!this.regExp&&!this.type.isSubTypeOf(ts.NIL)){
            t.addMeta(new rs.HasProperty(this.id));
        }
        var matchesPropertyFacet:rs.MatchesProperty;
        if (this.additonal){
            matchesPropertyFacet = new rs.AdditionalPropertyIs(this.type);
        }
        else if (this.regExp){
            matchesPropertyFacet = new rs.MapPropertyIs(this.id,this.type,this.optional);
        }
        else{
            matchesPropertyFacet = new rs.PropertyIs(this.id,this.type,this.optional);
        }
        if(matchesPropertyFacet!=null){
            t.addMeta(matchesPropertyFacet);
            if(this.type instanceof ts.InheritedType && this.type.name()==null){
                //Linking anonymous types with properties declaring them
                (<ts.InheritedType>this.type).setContextMeta(matchesPropertyFacet);
            }
            if(this.annotations && this.annotations.length){
                for(let a of this.annotations){
                    const a1 = new meta.Annotation(a.name,a.value,a.key);
                    a1.setOwnerFacet(matchesPropertyFacet);
                    matchesPropertyFacet.addAnnotation(a1);
                }
            }
        }
    }
}
export class TypeCollection {
    private _types:AbstractType[]=[];
    private _typeMap:{[name:string]:AbstractType}={};
    private uses:{ [name: string]: TypeCollection }={}

    private _annotationTypes:AbstractType[]=[];
    private _annotationTypeMap:{[name:string]:AbstractType}={};


    library(n:string){
        return this.uses[n];
    }

    addLibrary(n:string,t: TypeCollection){
        this.uses[n]=t;
    }


    add(t:AbstractType){
        this._types = this._types.filter(x=>x.name()!=t.name());
        this._types.push(t);
        this._typeMap[t.name()]=t;
    }

    getType(name:string){
        if (this._typeMap.hasOwnProperty(name)) {
            return this._typeMap[name];
        }
        return null;
    }

    addAnnotationType(t:AbstractType){
        this._annotationTypes.push(t);
        this._annotationTypeMap[t.name()]=t;
    }

    getAnnotationType(name:string){
        if (this._annotationTypeMap.hasOwnProperty(name)) {
            return this._annotationTypeMap[name];
        }
        return null;
    }

    types(){
        return this._types;
    }
    annotationTypes(){
        return this._annotationTypes;
    }

    getAnnotationTypeRegistry():TypeRegistry{
        var r=new TypeRegistry(ts.builtInRegistry(),this,true);
        this.annotationTypes().forEach(x=>r.addType(x));
        Object.keys(this.uses).forEach(x=>{
            this.uses[x].annotationTypes().forEach(y=>r.put(x+"."+ y.name(),y));
        })
        return r;
    }
    getTypeRegistry():TypeRegistry{
        var r=new TypeRegistry(ts.builtInRegistry(),this);
        this.types().forEach(x=>r.addType(x));

        Object.keys(this.uses).forEach(x=>{
            this.uses[x].types().forEach(y=>r.put(x+"."+ y.name(),y));
        })
        return r;
    }
}

export class AccumulatingRegistry extends ts.TypeRegistry{

    private static CLASS_IDENTIFIER_AccumulatingRegistry = "parse.AccumulatingRegistry.lite";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(AccumulatingRegistry.CLASS_IDENTIFIER_AccumulatingRegistry);
    }

    public static isInstance(instance : any) : instance is AccumulatingRegistry {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(),AccumulatingRegistry.CLASS_IDENTIFIER_AccumulatingRegistry);
    }
    constructor(private toParse:ParseNode,private schemas:ParseNode,ts:ts.TypeRegistry,protected _c:TypeCollection){
        super(ts,_c)
    }


    parsing:{ [name:string]:boolean}={};

    get(name: string ):ts.AbstractType{
        var result=super.get(name);

        if (!result||result.isSubTypeOf(ts.REFERENCE)){

            var chld=this.toParse?this.toParse.childWithKey(name):null;
            if (!chld){
                chld=this.schemas?this.schemas.childWithKey(name):null;
            }
            if (chld){
                if (this.parsing[name]){
                    var recurrent = ts.derive(name,[ts.RECURRENT]);
                    if(result && result.isSubTypeOf(ts.REFERENCE)){
                        (<ts.InheritedType>result).patch(recurrent);
                    }
                    else{
                        result = recurrent;
                    }
                    return result;
                }
                this.parsing[name]=true;
                try {
                    var tp = parse(name, chld, this,false,
                        false,
                        true,
                        false,this._c);
                }
                finally {
                    delete this.parsing[name];
                }
                return tp;
            }
            else{
                var dt=name.indexOf('.');
                if (dt!=-1){
                    var ln=name.substring(0,dt);
                    var tn=name.substr(dt+1);
                    var lib=this._c.library(ln);
                    if (lib){
                        var t=lib.getType(tn);
                        if (t){
                            return t;
                        }
                    }
                }
            }
        }
        return result;
    }
}

export function parseTypes(n:any,tr:ts.TypeRegistry=ts.builtInRegistry()):TypeCollection{
    var provider: su.IContentProvider = n.provider && n.provider();

    return parseTypeCollection(new JSObjectNode(null,n, false, provider),tr);
}

class WrapArrayNode implements ParseNode{
    constructor(private n:ParseNode){


    }
    key():string{
        return null
    }

    value():any{
        return null;
    }
    childWithKey(k:string):ParseNode{
        var r=this.children();
        for (var i=0;i< r.length;i++){
            if (r[i].key()==k){
                return r[i];
            }
        }
        return null;
    }

    children():ParseNode[]{
        return this.n.children().map(x=>{
            var c=x.children();
            if (c.length==1){
                return c[0];
            }
            return x;
        });
    }


    kind():NodeKind{
        return NodeKind.MAP;
    }
}

function  transformToArray(n:ParseNode):ParseNode{
    return new WrapArrayNode(n);
}

export function parseTypeCollection(n:ParseNode,tr:ts.TypeRegistry):TypeCollection{
    var result=new TypeCollection();
    if (n.anchor){
        if (n.anchor().__$$){
            return n.anchor().__$$;
        }
        n.anchor().__$$=result;
    }

    var tpes=n.childWithKey("types");
    if (tpes&&tpes.kind()===NodeKind.ARRAY){
        tpes=transformToArray(tpes);
    }

    var schemas=n.childWithKey("schemas");
    if (schemas&&schemas.kind()===NodeKind.ARRAY){
        schemas=transformToArray(schemas);
    }

    var reg=new AccumulatingRegistry(tpes,schemas,tr,result);
    if (tpes&&tpes.kind()!==NodeKind.SCALAR){
        tpes.children().filter(x=>x.key()&&true).forEach(x=>{
            var t = ts.derive(x.key(),[ts.REFERENCE]);
            result.add(t);
            reg.addType(t);
        });
    }
    if (schemas&&schemas.kind()!==NodeKind.SCALAR){
        schemas.children().filter(x=>x.key()&&true).forEach(x=>{
            var t = ts.derive(x.key(),[ts.REFERENCE]);
            result.add(t);
            reg.addType(t);
        });
    }

    var uses=n.childWithKey("uses");
    if (uses&&uses.kind()===NodeKind.ARRAY){
        uses=transformToArray(uses);
    }
    if (uses&&uses.kind()===NodeKind.MAP){
        uses.children().forEach(c=>{
            result.addLibrary(c.key(),parseTypeCollection(c,tr));
        })
    }

    if (tpes&&tpes.kind()!==NodeKind.SCALAR){
        tpes.children().filter(x=>x.key()&&true).forEach(x=>{
            reg.get(x.key());
        });
    }
    if (schemas&&schemas.kind()!==NodeKind.SCALAR){
        schemas.children().filter(x=>x.key()&&true).forEach(x=>{
            reg.get(x.key());
        });
    }
    reg.types().forEach(x=>result.add(x));
    var tpes=n.childWithKey("annotationTypes");
    if (tpes&&tpes.kind()===NodeKind.ARRAY){
        tpes=transformToArray(tpes);
    }
    if (tpes!=null&&tpes.kind()===NodeKind.MAP){
        tpes.children().forEach(x=>{
            result.addAnnotationType(parse(x.key(),x,reg,false,true,false))
        });
    }
    result.types().forEach(x=>(<any>x)._collection=result)
    result.annotationTypes().forEach(x=>(<any>x)._collection=result)
    return result;
}

export function parsePropertyBean(n:ParseNode,tr:ts.TypeRegistry,c:IParsedTypeCollection):PropertyBean{
    var result=new PropertyBean();
    var hasRequiredFacet = false;
    var requiredNode=n.childWithKey("required");
    const key = n.key() || (n.childWithKey("name")&&n.childWithKey("name").value());
    if (requiredNode){
        var rsValue = requiredNode.value();
        if (typeof rsValue==="boolean"){
            hasRequiredFacet = true;
        }
        else if(rsValue && typeof(rsValue)==="object" && typeof rsValue.value ==="boolean"){
            hasRequiredFacet = true;
            let annotations = Object.keys(rsValue).filter(x=>{
                x = x.trim();
                return x.length>1 && x.charAt(0)=="(" && x.charAt(x.length-1)==")";
            });
            if(annotations.length) {
                result.annotations = annotations.map(x=>{
                    x = x.trim();
                    return {
                        name: x.substring(1,x.length-1).trim(),
                        key: x,
                        value: rsValue[x]
                    };
                });
            }
        }
        if (rsValue===false){
            result.optional=true;
            result.id= key;
        }
    }
    var name:string= key;
    if (!hasRequiredFacet&&endsWithQuestionMark(key)){
        name=name.substr(0,name.length-1);
        result.optional=true;
    }
    if (name != null && name.length==0||name==='/.*/'){
        result.additonal=true;

    }
    else if (name.charAt(0)=='/'&&name.charAt(name.length-1)=='/'){
        name=name.substring(1,name.length-1);
        result.regExp=true;
    }
    result.type = parse(null, n,tr,false,false,false,false,c);

    let filterOut = [ "typePropertyKind","sourceMap", "required", "notScalar" ];
    if(!result.type.isBuiltin()&&!result.type.name()) {
        const nonDefaultMeta = result.type.declaredFacets().filter(x => {
            if (filterOut.indexOf(x.facetName()) >= 0) {
                return false;
            }
            if (meta.DiscriminatorValue.isInstance(x)) {
                return x.isStrict();
            }
            return true;
        });
        if (!nonDefaultMeta.length && result.type.superTypes().length == 1) {
            let meta = result.type.meta();
            result.type = result.type.superTypes()[0];
            if(!result.type.isBuiltin()){
                let metaMap: { [key: string]: boolean } = {};
                metaMap[tsInterfaces.MetaInformationKind.Required] = true;
                result.type.meta().forEach(x => metaMap[x.kind()] = true);
                meta.filter(x => !metaMap[x.kind()]).forEach(x => result.type.addMeta(x));
            }
        }
    }
    result.id=name;
    return result;
}

export class TypeProto{
    name: string

    properties:PropertyBean[];

    basicFacets: ts.TypeInformation[];

    facetDeclarations: meta.FacetDeclaration[]

    annotations: Annotation[]

    customFacets: meta.CustomFacet[]

    notAScalar:boolean

    superTypes: string[]

    additionalProperties: boolean

    toJSON(){
        var result:{ [name:string]:any}={};
        if (this.superTypes&&this.superTypes.length>0){
            if (this.superTypes.length==1){
                result['type']=this.superTypes[0];
            }
            else{
                result['type']=this.superTypes;
            }
        }
        if (this.customFacets){
            this.customFacets.forEach(x=>result[x.facetName()]= x.value());
        }
        if (this.annotations){
            this.annotations.forEach(x=>result["("+x.facetName()+")"]= x.value());
        }

        if (this.facetDeclarations&&this.facetDeclarations.length>0){
            var facets:{ [name:string]:any}={};
            this.facetDeclarations.forEach(x=>{
                var nm= x.facetName();
                if (x.isOptional()){
                    nm=nm+"?";
                }
                var vl:any=null;
                if (x.type().isAnonymous()){
                    if (x.type().isEmpty()) {
                        vl = typeToSignature(x.type());
                    }
                    else{
                        vl=toProto(x.type()).toJSON();
                    }
                }
                else{
                    vl=typeToSignature(x.type());
                }
                facets[nm]=vl;
            });
            result['facets']=facets;
        }
        if (this.properties&&this.properties.length>0){
            var properties:{ [name:string]:any}={};
            this.properties.forEach(x=>{
                var nm= x.id;
                if (x.optional){
                    nm=nm+"?";
                }
                if (x.additonal){
                    nm="/.*/"
                }
                if (x.regExp){
                    nm="/"+x.id+"/";
                }
                var vl:any=null;
                if (x.type.isAnonymous()){
                    if (x.type.isEmpty()) {
                        vl = typeToSignature(x.type);
                    }
                    else{
                        vl=toProto(x.type).toJSON();
                    }
                }
                else{
                    vl=typeToSignature(x.type);
                }
                properties[nm]=vl;
            });
            result['properties']=properties;
        }
        if (this.basicFacets) {
            this.basicFacets.forEach(x=> {
                var vc=x.value();
                if (vc instanceof AbstractType){
                    vc=storeAsJSON(vc);
                }
                result[x.facetName()] = vc;
            })
        }
        if (Object.keys(result).length==1&&!this.notAScalar){
            if (result['type']){
                return result['type'];
            }
        }
        if(this.additionalProperties!==undefined){
            result["additionalProperties"] = this.additionalProperties;
        }

        return result;
    }
}

export function toProto(type:AbstractType):TypeProto{
    var result:TypeProto=new TypeProto();
    result.name=type.name();
    result.superTypes=type.superTypes().map(x=>typeToSignature(x));
    result.annotations=[];
    result.customFacets=[];
    result.facetDeclarations=[];
    result.basicFacets=[];
    result.properties=[];
    var pmap:{[name:string]:PropertyBean}={}
    type.declaredMeta().forEach(x=>{
        if (x instanceof meta.Annotation){
            result.annotations.push(x);
        }
        else if (x instanceof meta.CustomFacet){
            result.customFacets.push(x);
        }else if (x instanceof meta.NotScalar){
            result.notAScalar=true;
        }
        else if (x instanceof FacetDeclaration){
            result.facetDeclarations.push(x);
        }
        else{
            if (x instanceof rs.HasProperty){
                if (pmap.hasOwnProperty(x.value())){
                    pmap[x.value()].optional=false;
                }
                else{
                    var pbean=new PropertyBean();
                    pbean.optional=false;
                    pbean.id= x.value();
                    pbean.type=ts.ANY;
                    pmap[x.value()]=pbean;
                }
            }
            else if (x instanceof rs.AdditionalPropertyIs){

                var pbean=new PropertyBean();
                pbean.optional=false;
                pbean.id= ".*";
                pbean.additonal=true;
                pbean.type= x.value();
                pbean.optional = x.isOptional();
                pbean.regExp=true;
                pmap['/.*/']=pbean;
            }
            else if (rs.MapPropertyIs.isInstance(x)){
                var pbean=new PropertyBean();
                pbean.optional=false;
                pbean.id= x.regexpValue();
                pbean.regExp=true;
                pbean.type= x.value();
                pbean.optional = x.isOptional();
                pmap[x.regexpValue()]=pbean;
            }
            else if (rs.PropertyIs.isInstance(x)){
                if (pmap.hasOwnProperty(x.propertyName())){
                    pmap[x.propertyName()].type= x.value();
                }
                else{
                    var pbean=new PropertyBean();
                    pbean.optional=true;
                    pbean.id= x.propertyName();
                    pbean.type= x.value();
                    pmap[x.propertyName()]=pbean;
                }
            }
            else if (rs.KnownPropertyRestriction.isInstance(x)) {
                result.additionalProperties = x.value();
            }
            else if(meta.DiscriminatorValue.isInstance(x)){
                if((<meta.DiscriminatorValue>x).isStrict()){
                    result.basicFacets.push(x);
                }
            }
            else if(!meta.HasPropertiesFacet.isInstance(x)) {
                result.basicFacets.push(x);
            }
        }
    })
    Object.keys(pmap).forEach(x=>result.properties.push(pmap[x]));
    return result;
}

/***
 * stores a type to JSON structure
 * @param ts
 */
export function storeAsJSON(ts:AbstractType|TypeCollection) : any{
    if (ts instanceof AbstractType) {
        if (ts.isBuiltin()){
            return ts.name();
        }
        return toProto(ts).toJSON();
    }
    else{
        return storeTypeCollection(<TypeCollection>ts);
    }
}
function storeTypeCollection(tc:TypeCollection):any{
    var res:any={};
    var types:any={};
    tc.types().forEach(x=>{
        types[x.name()]=storeAsJSON(x);
    })
    if (Object.keys(types).length>0) {
        res["types"] = types;
    }
    var types:any={};
    tc.annotationTypes().forEach(x=>{
        types[x.name()]=storeAsJSON(x);
    })
    if (Object.keys(types).length>0) {
        res["annotationTypes"] = types;
    }
    return res;
}

function typeToSignature(t:ts.AbstractType):string{
    if (t.isAnonymous()){
        if (t.isArray()){
            var ci=t.oneMeta(rs.ComponentShouldBeOfType);
            if (ci){
                var vl=ci.value();
                if (vl.isAnonymous()&&vl.isUnion()){
                    return "("+typeToSignature(vl)+")"+"[]";
                }
                return typeToSignature(vl)+"[]";
            }
        }
        if (t.isUnion()){
            return (<ts.UnionType>t).options().map(x=>typeToSignature(x)).join(" | ");
        }
        return t.superTypes().map(x=>typeToSignature(x)).join(" , ");
    }
    return t.name();
}

/**
 * Analogue of type.isSubTypeOf(), but also checks through unions
 * @param potentialSubtype
 * @param potentialSupertype
 */
function isSubtypeOf(potentialSubtype : ts.AbstractType, potentialSupertype : ts.AbstractType) : boolean {
    //TODO this algorithm should be moved to type.isSubTypeOf() after release (now leaving it here for safety)
    if (potentialSupertype===ts.ANY ||
        potentialSubtype===potentialSupertype ||
        potentialSubtype.superTypes().some(
            currentSuperType=>isSubtypeOf(currentSuperType,potentialSupertype))) {

        return true;
    }

    if (potentialSubtype.isUnion() && (<any>potentialSubtype).options) {
        var options = (<ts.UnionType>potentialSubtype).options();
        if (options.some(
                option=>isSubtypeOf(option,potentialSupertype))) return true;
    }

    if (potentialSupertype.isUnion() && (<any>potentialSupertype).options) {
        var options = (<ts.UnionType>potentialSupertype).options();
        if (options.some(
                option=>potentialSubtype==option)) return true;
    }

    return false;
}

function testFacetAgainstType(facet : ts.TypeInformation, type : ts.AbstractType) : boolean {
    var requiredType = facet.requiredType();
    var requiredTypes = facet.requiredTypes();

    if (requiredTypes && requiredTypes.length > 0) {
        return requiredTypes.some(currentRType=>isSubtypeOf(type, currentRType))
    } else {
        return isSubtypeOf(type, requiredType);
    }
}

function appendAnnotations(appendedInfo:ts.TypeInformation, childNode:ParseNode) {
    let arr = childNode.kind() == NodeKind.ARRAY ? childNode.children() : [childNode];
    for (let i = 0 ; i < arr.length ; i++) {
        let children = arr[i].children();
        for (let ch of children) {
            let key = ch.key();
            if (key && key.charAt(0) == "(" && key.charAt(key.length - 1) == ")") {
                let aName = key.substring(1, key.length - 1);
                let aInstance = new meta.Annotation(aName, ch.value(), key, i);
                aInstance.setOwnerFacet(appendedInfo);
                aInstance._owner = appendedInfo._owner;
                appendedInfo.addAnnotation(aInstance);
            }
        }
    }
}
/**
 * parses a type from a JSON structure
 * @param name
 * @param n
 * @param r
 * @returns {any}
 */
export function parseWithCollection(
    name: string,
    n:ParseNode,
    r:IParsedTypeCollection,
    defaultsToAny:boolean=false,
    annotation:boolean=false,
    global:boolean=true,
    ignoreTypeAttr:boolean=false):ts.AbstractType{
    let res=parse(name,n,<ts.TypeRegistry>r.getTypeRegistry(),defaultsToAny,annotation,global,ignoreTypeAttr,r);
    (<any>res)._collection=r;
    return res;
}

export function parseJsonTypeWithCollection(
    name: string,
    n:any,
    r:IParsedTypeCollection,
    defaultsToAny:boolean=false,
    annotation:boolean=false,
    global:boolean=true,
    ignoreTypeAttr:boolean=false):ts.AbstractType{
    let res=parse(name,new JSObjectNode(null,n, false, null),<ts.TypeRegistry>(r&&r.getTypeRegistry()),defaultsToAny,annotation,global,ignoreTypeAttr,r);
    (<any>res)._collection=r;
    return res;
}

function parse(
    name: string,
    n:ParseNode,
    r:ts.TypeRegistry=ts.builtInRegistry(),
    defaultsToAny:boolean=false,
    annotation:boolean=false,
    global:boolean=true,
    ignoreTypeAttr:boolean=false,_col?:IParsedTypeCollection):ts.AbstractType{

    //mentioning fragment' uses
    var uses=n.childWithKey("uses");
    if (uses){
        if(uses.kind()===NodeKind.ARRAY){
            uses = transformToArray(uses);
        }
        if (uses.kind()===NodeKind.MAP){
            var col = new TypeCollection();
            uses.children().forEach(c=>{
                col.addLibrary(c.key(),parseTypeCollection(c,ts.builtInRegistry()));
            });
            r = new AccumulatingRegistry(null,null,r,col);
        }
    }

    if (n.kind()==NodeKind.SCALAR){
        var valString = n.value();
        var sp:ts.AbstractType;
        if(valString==null||valString=="Null"||valString=="NULL"){
            sp = ts.STRING;
        }
        else{
            sp = typeExpressions.parseToType(""+valString,r, n)
        }
        if (name==null){
            return sp;
        }
        var res=ts.derive(name,[sp]);
        if (r instanceof AccumulatingRegistry){
            res = contributeToAccumulatingRegistry(res, r);
        }
        return res;
    }
    if (n.kind()==NodeKind.ARRAY){
        var supers:ts.AbstractType[]=[];
        n.children().forEach(x=>{
            supers.push(typeExpressions.parseToType(""+x.value(),r, n))
        })
        var res=ts.derive(name,supers);
        if (AccumulatingRegistry.isInstance(r)){
            res = contributeToAccumulatingRegistry(res, r);
        }
        return res;
    }

    var superTypes:AbstractType[]=[];
    var tp=n.childWithKey("type");
    var shAndType:boolean=false;
    if (!tp){
        tp=n.childWithKey("schema");
    }
    else{
        if (n.childWithKey("schema")){
            shAndType=true;
        }
    }
    var typePropAnnotations:tsInterfaces.IAnnotation[][] = [];
    if (!tp||(!tp.children().length&&!tp.value())||ignoreTypeAttr){
        if (defaultsToAny){
            if (n.childWithKey("properties")) {
                superTypes = [ts.OBJECT];
                }
            else {
                superTypes = [ts.ANY];
            }
        }
        else {
            if (n.childWithKey("properties")) {
                superTypes = [ts.OBJECT];
            }
            else {
                superTypes = [ts.STRING];
            }
        }
    }
    else{
        var sAnnotations:ParseNode[][] = [];
        var actual = tp.childWithKey("value");
        if(actual&&(actual.kind()==NodeKind.SCALAR||actual.kind()==NodeKind.ARRAY)){
            sAnnotations = [ tp.children().filter(x=>{
                var key = x.key();
                if(!key){
                    return false;
                }
                return key.charAt(0) == "(" && key.charAt(key.length - 1) == ")";
            }) ]
            tp = actual;
        }
        if (tp.kind()==NodeKind.SCALAR){
            var valString = tp.value();
            if(valString==null||valString=="Null"||valString=="NULL"){
                superTypes = [ ts.STRING ];
            }
            else{
                var typeAttributeContentProvider : su.IContentProvider =
                    (<any>tp).contentProvider ? (<any>tp).contentProvider() : null;
                const st = typeExpressions.parseToType(""+valString,r, n, typeAttributeContentProvider);
                superTypes=[st];
            }
        }
        else if (tp.kind()==NodeKind.ARRAY){
            superTypes=tp.children().map(x=>{
                var actual = x.childWithKey("value");
                if(actual&&(actual.kind()==NodeKind.SCALAR||actual.kind()==NodeKind.ARRAY)){
                    sAnnotations.push(x.children().filter(x=>{
                        var key = x.key();
                        if(!key){
                            return false;
                        }
                        return key.charAt(0) == "(" && key.charAt(key.length - 1) == ")";
                    }));
                    x = actual;
                }
                else{
                    sAnnotations.push([]);
                }
                return x;
            }).map(y=>{
                if(y.kind()==NodeKind.MAP){
                    return parse("", y, r, false, false, false);
                }
                else {
                    return typeExpressions.parseToType(y.value(),r, n);
                }
            });
        }
        else if (tp.kind()==NodeKind.MAP){
            superTypes=[parse("",tp,r,false,false,false)];
        }
        superTypes = superTypes.filter(x=>x!=null);
        if(sAnnotations.length>0 && sAnnotations.filter(x=>x.length>0).length>0) {
            for(var aArr of sAnnotations){
                var aiArr:meta.Annotation[] = [];
                typePropAnnotations.push(aiArr);
                for(var ann of aArr) {
                    var key = ann.key();
                    var aName = key.substring(1, key.length - 1);
                    var aInstance = new meta.Annotation(aName, ann.value(), key);
                    aInstance.setNode(ann);
                    aiArr.push(aInstance);
                }
            }
        }
    }
    var result:AbstractType=null;
    if (superTypes.length==1
        &&superTypes[0].name()=="union"
        &&superTypes[0].options().length<2){

        const anyOf = n.childWithKey("anyOf");
        const optNodes = anyOf && anyOf.children();
        if(optNodes && optNodes.length){
            const opts = optNodes.map(o=>{
                let parsedOption = parse("",o,r,false,false,false);
                if(o.kind()==NodeKind.SCALAR){
                    parsedOption = parsedOption.superTypes()[0]
                }
                return parsedOption;
            });
            if(n.childWithKey("properties")){
                superTypes = [ ts.union(name,opts) ];
            }
            else{
                let filterOut = [ "type","typePropertyKind","schema,","sourceMap", "__METADATA__", "required", "example", "examples" ];
                const meta = n.children().filter(x=>{
                    if(filterOut.indexOf(x.key())>=0){
                        return false;
                    }
                    let f = facetR.getInstance().buildFacet(x.key(), x.value());
                    return f != null;
                });
                if(meta.length){
                    superTypes = [ ts.union("",opts) ];
                }
                else {
                     result = ts.union(name, opts);
                }
            }
        }
    }
    if (superTypes.length==1&&superTypes[0].isAnonymous()&&false){
       // var ab:AbstractType= superTypes[0];
       // ab.patchName(name);
       // result=ab;
    }
    else if(!result){
       result = ts.derive(name, superTypes);
    }
    if(ignoreTypeAttr && tp){
        result.addMeta(new meta.TypeAttributeValue(tp.value()));
    }
    for(var i = 0 ; i < typePropAnnotations.length ; i++){
        var aArr1:tsInterfaces.IAnnotation[] = typePropAnnotations[i];
        result.addSupertypeAnnotation(aArr1,i);
    }
    if (AccumulatingRegistry.isInstance(r)){
        result = contributeToAccumulatingRegistry(<any>result, r);
    }
    var actualResult=result;
    var hasfacetsOrOtherStuffDoesNotAllowedInExternals:string[]=null;

    n.children().forEach(childNode=>{

        var key = childNode.key();
        actual = childNode.childWithKey("value");
        var x = childNode;
        if(key!="example"&&actual){
            x = actual;
        }
        if (!key){
            return;
        }
        if (key==="type"){
            return;
        }

        if (key==="uses"){

            //FIXME this should be handled depending from parse level
            return;
        }
        if (key==="schema"){
            return;
        }
        if (key=="properties"||key=="additionalProperties"){
            if (result.isSubTypeOf(ts.OBJECT)){
                return;
            }
        }
        var appendedInfo:ts.TypeInformation;
        if (key=="items"){
            if (result.isSubTypeOf(ts.ARRAY)){
                var componentTypes:ts.AbstractType[] = [];
                let arr:ParseNode[] = [x];
                if(x.kind()==NodeKind.ARRAY){
                    arr = x.children()
                    let err=ts.error(messageRegistry.ITEMS_SHOULD_BE_REFERENCE_OR_INLINE_TYPE,actualResult);
                    err.setValidationPath({ name:"items"})
                    result.putExtra(tsInterfaces.PARSE_ERROR,err);
                }
                var componentTypes:ts.AbstractType[] = arr.map(y=>{
                    let actual = y.childWithKey("value");
                    if(actual&&(actual.kind()==NodeKind.SCALAR||actual.kind()==NodeKind.MAP)){
                        y = actual;
                    }
                    if (y.kind()==NodeKind.SCALAR){
                        var valString = y.value();
                        if(valString==null||valString=="Null"||valString=="NULL"){
                            return ts.STRING;
                        }
                        else{
                            return typeExpressions.parseToType(""+valString,r, n);
                        }
                    }
                    else if (y.kind()==NodeKind.MAP){
                        return parse("",y,r,false,false,false);
                    }
                });
                var tp = componentTypes.length == 1 ? componentTypes[0] :
                    ts.derive("",componentTypes);
                (<any>tp)._collection=_col;
                appendedInfo = new ComponentShouldBeOfType(tp);
                actualResult.addMeta(appendedInfo);
                actualResult.putExtra(tsInterfaces.HAS_ITEMS,true)
                appendAnnotations(appendedInfo, childNode);
                return appendedInfo;
            }
        }
        else {
            if (key === "facets") {
                hasfacetsOrOtherStuffDoesNotAllowedInExternals = [key];
                return;
            }
            else if (key == "default" || key == "xml" || key == "required") {
                hasfacetsOrOtherStuffDoesNotAllowedInExternals =
                    hasfacetsOrOtherStuffDoesNotAllowedInExternals ?
                        hasfacetsOrOtherStuffDoesNotAllowedInExternals.concat(key):[key];
            }
            else if (key.charAt(0) == '(' && key.charAt(key.length - 1) == ')') {
                let a = new meta.Annotation(key.substr(1, key.length - 2), x.value(), key);
                a.setNode(x);
                result.addMeta(a);
                return;
            }
            appendedInfo = facetR.getInstance().buildFacet(key, x.value());

            //TODO remove "format" condition and use this check for all facets
            if (appendedInfo && (key != "format" || testFacetAgainstType(appendedInfo, result))) {
                appendedInfo.setNode(x);
                result.addMeta(appendedInfo);
            }
            else {
                // if (annotation && key === "allowedTargets") {
                //     result.addMeta(new meta.AllowedTargets(x.value()));
                // }
                {//else {
                    if(key!="name"&&key!="simplifiedExamples"&&key!="anyOf") {
                        var customFacet = new meta.CustomFacet(key, x.value());
                        customFacet.setNode(x);
                        result.addMeta(customFacet);
                    }
                }
            }
        }
        if(appendedInfo){
            appendAnnotations(appendedInfo, childNode);
        }
    });
    (<any>result)._collection=_col;
    if(result.metaOfType(meta.DiscriminatorValue).length==0){
        result.addMeta(new meta.DiscriminatorValue(result.name(),false));
    }
    if (result.isSubTypeOf(ts.OBJECT)) {
        var props=n.childWithKey("properties");
        var hasProps=false;
        if (props) {
            result.addMeta(new meta.HasPropertiesFacet());
            if (props.kind() == NodeKind.MAP||props.kind()==NodeKind.ARRAY) {
                props.children().forEach(x=> {
                    hasProps = true;
                    parsePropertyBean(x, r,_col).add(result);
                });
            }
            else{
                var err=ts.error(messageRegistry.PROPERTIES_MAP,actualResult);
                err.setValidationPath({ name:"properties"})
                result.putExtra(tsInterfaces.PARSE_ERROR,err);
            }
        }
        var ap= n.childWithKey("additionalProperties");
        if (ap){
            actual = ap.childWithKey("value");
            if(actual){
                ap = actual;
            }

            if (typeof(ap.value()) == "boolean") {
                result.addMeta(new KnownPropertyRestriction(ap.value()));
            } else {
                var err=ts.error(messageRegistry.ADDITIONAL_PROPERTIES_BOOLEAN,actualResult);
                err.setValidationPath({ name:"additionalProperties"})
                result.putExtra(tsInterfaces.PARSE_ERROR,err);
            }

        }
    }

    var props=n.childWithKey("facets");
    if (props){
        if (props.kind()==NodeKind.MAP){
            props.children().forEach(x=>{
                var bean=parsePropertyBean(x,r,_col);
                result.addMeta(new meta.FacetDeclaration(bean.id,bean.type,bean.optional));
            });
        }
        else{
            var err=ts.error(messageRegistry.FACETS_MAP,actualResult);
            err.setValidationPath({ name:"facets"})
            result.putExtra(tsInterfaces.PARSE_ERROR,err);
        }
    }
    if (result.isAnonymous()&&result.isEmpty()){
        if (result.superTypes().length==1){
            let meta = result.meta();
            let res = result.superTypes()[0];
            if(!res.isBuiltin()){
                let metaMap:{[key:string]:boolean} = {};
                res.meta().forEach(x=>metaMap[x.kind()]=true);
                meta.filter(x=>!metaMap[x.kind()]).forEach(x=>res.addMeta(x));
            }
            return res;
        }
    }
    if (n.kind()!=NodeKind.SCALAR){
        result.addMeta(new meta.NotScalar());
    }
    if (shAndType){
        actualResult.putExtra(ts.SCHEMA_AND_TYPE,true);
    }
    actualResult.putExtra(ts.GLOBAL,global);
    actualResult.putExtra(ts.SOURCE_EXTRA, n);
    if(hasfacetsOrOtherStuffDoesNotAllowedInExternals) {
        actualResult.putExtra(tsInterfaces.HAS_FACETS, hasfacetsOrOtherStuffDoesNotAllowedInExternals);
    }

    return actualResult;
}

function contributeToAccumulatingRegistry(result:ts.InheritedType,r:TypeRegistry):ts.InheritedType {

    var existing:ts.InheritedType;
    var _r = r;
    while(_r){
        existing = <ts.InheritedType>_r.typeMap()[result.name()];
        if(existing){
            break;
        }
        _r = _r.parent();
    }
    if (existing == null || !existing.isSubTypeOf(ts.REFERENCE)) {
        r.addType(result);
    }
    else if (existing != null && existing.isSubTypeOf(ts.REFERENCE)) {
        (<ts.InheritedType>existing).patch(result);
        result = existing;
    }
    result.putExtra(tsInterfaces.TOP_LEVEL_EXTRA, true);
    return result;
};

export function builtInTypes():tsInterfaces.ITypeRegistry {
    return ts.builtInRegistry();
}
