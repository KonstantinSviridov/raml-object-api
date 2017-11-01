import index = require("../index");
import ts = index.typeSystem;
import ti = ts.tsInterfaces;
import raml = require("./model-interfaces");
import api = require("../typings-new-format/spec-1.0/api");
import datamodel = require("../typings-new-format/spec-1.0/datamodel");
import resources = require("../typings-new-format/spec-1.0/resources");
import methods = require("../typings-new-format/spec-1.0/methods");
import security = require("../typings-new-format/spec-1.0/security");
import common = require("../typings-new-format/spec-1.0/common");

function normalizeTypes(target: any, typesArray:datamodel.TypeDeclaration[], types: string, resultName: string = types) {
    if(!typesArray || !typesArray.length){
        return ;
    }
    for (let t of typesArray) {
        let nm = t.name;
        target[resultName][nm] = normalizeType(t);
    }
}
function normalizeType(i: datamodel.TypeReference10) {
    if (typeof i == "string") {
        return {type: i};
    }

    if (typeof i == "object") {
        if (Array.isArray(i)) {
            return {type: i};
        }
        let t = <datamodel.TypeDeclaration>i;
        let res: any = JSON.parse(JSON.stringify(t));
        //delete res.name;
        delete res.typePropertyKind;
        delete res.annotations;
        delete res.structuredExample;
        delete res.__METADATA__;
        delete res.mediaType;
        delete res.sourceMap;
        delete res.fixedFacets;
        delete res.simplifiedExamples;
        if(t.type && t.type.length){
            res.type = t.type.map(x=>{
                if(typeof(x) === "object"){
                    return normalizeType(x);
                }
                return x;
            });
        }
        if (t.examples) {
            if(t.examples.length==1 && t.examples[0].name==null){
                res.example = t.examples[0].value;
                delete res.examples;
            }
            else {
                let examples = {};
                t.examples.forEach(e => {
                    let name = e.name;
                    let ex = {
                        value: e.value,
                        strict: e.strict
                    };
                    if (e.annotations) {
                        Object.keys(e.annotations).forEach(x => {
                            ex['(' + x + ')'] = e.annotations[x].structuredValue;
                        });
                    }
                    if(!name){
                        res.example = ex;
                    }
                    else {
                        examples[e.name] = ex;
                    }
                });
                if(Object.keys(examples).length) {
                    res.examples = examples;
                }
            }
        }
        if (t.annotations) {
            for(let x of t.annotations){
                res[`(${x.name})`] = x.value;
            }
        }
        let properties = (<datamodel.ObjectTypeDeclaration>t).properties;
        if (properties && properties.length) {
            res.properties = properties.map(x=>normalizeType(x));
        }
        let facets = t.facets;
        if (facets && facets.length) {
            res.facets = facets.map(x=>normalizeType(x));
        }
        let items = (<datamodel.ArrayTypeDeclaration>t).items;
        if(items && items.length){
            res.items = normalizeType(items[0]);
        }
        if (t.fixedFacets) {
            for( let x of t.fixedFacets){
                res[x.name] = x.value;
            }
        }
        return res;
    }
}

function normalize(api: api.LibraryBase10) {
    let rs: any = {types: {}, annotationTypes: {}};
    normalizeTypes(rs, api.types, "types");
    normalizeTypes(rs, api.annotationTypes, "annotationTypes");
    return rs;
}

export abstract class Annotated{
    annotation(n:string){
        let res: ti.IAnnotation = null;
        this.annotations().forEach(x => {
            if (x.name() == n || x.name().endsWith("." + n)) {
                res = x;
            }
        })
        if (res) {
            return res.value();
        }
        return null;
    }
    abstract annotations(): ti.IAnnotation[]

    abstract scalarsAnnotations():{[key:string]:ti.IAnnotation[][]};
}

export abstract class Proxy<JSONType extends common.Annotable> extends Annotated implements ti.IAnnotatedElement {

    constructor(public readonly json: JSONType, public readonly parent: Proxy<any>) {
        super();
    }

    abstract name();

    abstract kind();

    owningFragment(): FragmentBase<any> {
        if (this.parent) {
            return this.parent.owningFragment();
        }
        if (this instanceof FragmentBase) {
            return <any>this;
        }
        return null;
    }

    description() {
        return (<any>this.json).description || (<any>this.json).usage
    }

    annotationsMap() {
        return null;
    }

    private _annotations;

    private _scalarsAnnotations;

    annotations(): ti.IAnnotation[] {
        if (this._annotations) {
            return this._annotations;
        }
        let result: Annotation[] = [];
        if (this.json.annotations) {
            Object.keys(this.json.annotations).forEach(x => {
                let v = this.json.annotations[x];
                result.push(new Annotation(v, this));
            })
        }
        this._annotations = result;
        return this._annotations;
    }

    value() {
        return this.json;
    }

    entry() {
        return this.json;
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        if (this._scalarsAnnotations) {
            return this._scalarsAnnotations;
        }
        let result:{[key:string]:Annotation[][]} = {};
        if (this.json.scalarsAnnotations) {
            Object.keys(this.json.scalarsAnnotations).forEach(x => {
                let srcArr1 = this.json.scalarsAnnotations[x];
                if(!srcArr1.length){
                    return;
                }
                let dstArr1:Annotation[][] = [];
                result[x] = dstArr1;
                for(let srcArr2 of srcArr1){
                    let dstArr2 = srcArr2.map(x=>new Annotation(x, this));
                    dstArr1.push(dstArr2);
                }
            });
        }
        this._annotations = result;
        return this._annotations;
    }
}

export class Annotation extends Proxy<common.AnnotationInstance> implements raml.IAnnotation {


    name(): string {
        return this.json.name;
    }

    isInheritable() {
        return false;
    }

    facetName() {
        return this.json.name;
    }

    owner() {
        return null;
    }

    ownerFacet() {
        return null;
    }

    kind() {
        return ti.MetaInformationKind.Annotation;
    }

    value() {
        return this.json.value;
    }

    definition(): ti.IParsedType {
        let library: FragmentBase<any> = this.owningFragment();
        let tp = library.getAnnotationType(this.json.name);
        if (tp) {
            return tp;
        }
        return null;
    }

    requiredType():ti.IParsedType{
        return null;
    }
    validateSelf(registry: ti.ITypeRegistry):ti.IStatus{ return null; }

    isConstraint(){
        return false;
    }
}


function unique(v: any[]) {
    return Array.from(new Set(v))
}

export abstract class FragmentBase<T> extends Proxy<T> {


    constructor(node: any, private tc: ti.IParsedTypeCollection) {
        super(node, null);
    }

    getType(name: string): ti.IParsedType {
        return this.tc.getType(name)
    }

    getTypeRegistry() {
        return this.tc.getTypeRegistry();
    }

    getAnnotationTypeRegistry() {
        return this.tc.getAnnotationTypeRegistry();
    }

    types() {
        return unique(this.tc.types())
    }

    annotationTypes() {
        return unique(this.tc.annotationTypes());
    }

    getAnnotationType(name: string): ti.IParsedType {
        return this.tc.getAnnotationType(name);
    }

    abstract kind():string;

}

export function mapArray<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = [];
    }
    return obj.map(x => x == null ? x : new clazz(x, parent));
}
export function mapArrayMaps<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = [];
    }
    return obj.map(x => new clazz(x, parent));
}
export function mapMap<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = {};
    }
    let res: T[] = [];
    Object.keys(obj).forEach(x => {
        res.push(new clazz(obj[x], parent))
    });
    return res;
}

function gatherResources(r: raml.Api|raml.Resource, res: raml.Resource[]) {
    let resources: raml.Resource[] = r.resources();
    resources.forEach(x => {
        res.push(x);
        gatherResources(x, res);
    })
}
export abstract class LibraryBase<T> extends FragmentBase<T> {

    securitySchemes() {
        return mapArrayMaps<SecuritySchemeDefinition>(this, "securitySchemes", SecuritySchemeDefinition);
    }

    add(t:ti.IParsedType): void{

    }

    addAnnotationType(t:ti.IParsedType): void{

    }

    library(name: string): ti.IParsedTypeCollection{
        return null;
    }
}
// export class SecuritySchemeRef extends Proxy<security.SecuritySchemeBase10> implements raml.SecuredBy {
//
//     name() {
//         if (typeof this.json == "string") {
//             return this.json;
//         }
//         return Object.keys(this.json)[0];
//     }
//
//     settings() {
//         if (typeof this.json == "string") {
//             return {}
//         }
//         return (<any>this.json)[Object.keys(this.json)[0]];
//     }
//
//     kind() {
//         return "SecuritySchemeRef";
//     }
//
//     securitySchemes() {
//         return mapArrayMaps<SecuritySchemeDefinition>(this, "securitySchemes", SecuritySchemeDefinition);
//     }
// }
export class Documentation extends  Proxy<api.DocumentationItem>{

    name(){
        return this.json.title;
    }

    title(){
        return this.json.title;
    }
    content(){
        return this.json.content;
    }

    kind(){
        return raml.NodeKindMap.RAML_KIND_DOCUMENTATION
    }
}
export class Api extends LibraryBase<api.Api10> implements raml.Api {

    baseUri(): string {
        return this.json.baseUri;
    }
    protocols(){
        return this.json.protocols;
    }
    mediaType(){
        return this.json.mediaType;
    }
    baseUriParameters(){
        if (this.json.baseUriParameters) {
            return params(this.json.baseUriParameters,this,"baseUri");
        }
        return []
    }

    documentation() {
        return mapArray(this, "documentation", Documentation)
    }

    securedBy() {
        return mapArray(this, "securedBy", SecuritySchemeDefinition)
    }

    version(): string {
        return this.json.version;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_API;
    }

    name() {
        return this.title();
    }

    title() {
        return this.json.title;
    }

    resources() {
        return mapArray<Resource>(this, "resources", Resource);
    }

    allResources() {
        let res: raml.Resource[] = []
        gatherResources(this, res);
        return res;
    }

    allMethods() {
        let meth: raml.Method[] = [];
        this.allResources().forEach(x => {
            meth = meth.concat(x.methods());
        })
        return meth;
    }
}

function bodies(t: Method|Response) {
    if (!t.json.body) {
        return [];
    }
    let result: Body[] = []
    for(let x of t.json.body){
        let name = x.name;
        let td = normalizeType(x);
        let parsedType = ts.parseJsonTypeWithCollection("", td, <any>t.owningFragment(), true);
        result.push(new Body(name, parsedType));
    }
    return result;
}
function isRequired(parsedType: ti.IParsedType) {
    return parsedType.allFacets().some(x => x.kind() == ti.MetaInformationKind.Required && x.value());
}
function params(v: datamodel.TypeDeclaration[], parent: Proxy<any>, location: string) {

    let result: Parameter[] = [];
    if (v && v.length>0) {
        for( let x of v){
            let td = normalizeType(x);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>parent.owningFragment(), false);
            result.push(new Parameter(x.name, parsedType, isRequired(parsedType), location));
        }
    }
    return result;
}

export class Response extends Proxy<methods.Response10> implements raml.Response {
    name() {
        return this.json.code;
    }

    code() {
        return this.json.code;
    }

    headers() {
        return params(this.json.headers, this, "responseHeaders");
    }

    bodies() {
        return bodies(this);
    }

    method() {
        return <Method>this.parent;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_RESPONSE;
    }
}
export class Body extends Annotated implements raml.Body {

    constructor(private mime: string, private p: ti.IParsedType) {
        super()
    }

    mimeType() {
        return this.mime;
    }

    type() {
        return this.p;
    }

    annotations() {
        return this.p.annotations();
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        return this.p.scalarsAnnotations();
    }
}
export class Parameter extends  Annotated implements raml.Parameter {

    constructor(private mime: string, private p: ti.IParsedType, private req: boolean, private loc: string) {
        super();
    }

    required() {
        return this.req;
    }

    location() {
        return this.loc;
    }

    name() {
        return this.mime;
    }

    type() {
        return this.p;
    }

    annotations() {
        return this.p.annotations();
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        return this.p.scalarsAnnotations();
    }
}

export class Method extends Proxy<methods.Method10> implements raml.Method {
    name() {
        return this.json.method
    }

    protocols(){
        if (this.json.protocols){
            return this.json.protocols;
        }
        return []
    }

    securedBy(): raml.SecuredBy[] {
        if (!this.json.securedBy && this.resource()) {
            return this.resource().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition)
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_METHOD;
    }

    displayName() {
        return this.json.displayName;
    }

    method() {
        return this.json.method;
    }

    parameters() {
        let initial: raml.Parameter[] =
            params(this.json.queryParameters, this, "query")
                .concat(params(this.json.headers, this, "headers"))
                .concat(params(this.json.uriParameters, this, "uriParameters"));

        initial = this.resource().allUriParameters().concat(initial);
        if (this.json.queryString) {
            let td = normalizeType(this.json.queryString);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>this.owningFragment(), false);
            initial.push(new Parameter("queryString", parsedType, isRequired(parsedType), "queryString"));
        }
        return initial;
    }

    bodies() {
        return bodies(this);
    }

    responses() {
        return mapMap(this, "responses", Response);
    }

    resource(): Resource {
        if (this.parent instanceof Resource) {
            return this.parent;
        }
        return null;
    }
}
/**
 *
 */
export class Library extends LibraryBase<api.Library> implements raml.Library {

    usage() {
        return this.json.usage;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_LIBRARY;
    }

    name() {
        return "";
    }
}
export class SecuritySchemeDefinition extends Proxy<security.SecuritySchemeBase10> implements raml.SecuritySchemeDefinition {

    settings() {
        return this.json.settings;
    }

    type() {
        return this.json.type;
    }

    name() {
        return this.json.name;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_SECURITY_SCHEME_DEFINITION;
    }
}

export class Resource extends Proxy<resources.Resource10> implements raml.Resource {

    securedBy(): raml.SecuredBy[] {
        if (!this.json.securedBy && this.owningApi()) {
            return this.owningApi().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition)
    }

    displayName() {
        return this.json.displayName;
    }

    description(){
        return this.json.description;
    }

    relativeUrl() {
        return this.json.relativeUri;
    }

    fullRelativeUrl() {
        let m = this.json.relativeUri;
        let pr = this.parentResource();
        if (pr) {
            m = pr.fullRelativeUrl() + m;
        }
        return m;
    }

    absoluteUrl() {
        return this.json.absoluteUri;
    }

    parentResource(): raml.Resource {
        if (this.parent instanceof Resource) {
            return this.parent;
        }
        return null;
    }

    uriParameters() {
        return params(this.json.uriParameters, this, "uri");
    }

    allUriParameters() {
        const ownUriParameters:raml.Parameter[] = this.uriParameters();
        let parentParameters:raml.Parameter[] = [];
        const paramsMap:{[key:string]:boolean} = {};
        ownUriParameters.forEach(x=>paramsMap[x.name()]=true);
        let p = this.parentResource();
        if (p) {
            parentParameters = p.allUriParameters();
        }
        else if(this.owningApi()){
            parentParameters = this.owningApi().baseUriParameters();
        }
        parentParameters = parentParameters.filter(x=>!paramsMap[x.name()]);
        return ownUriParameters.concat(parentParameters);
    }

    resources(): raml.Resource[] {
        return mapArray<Resource>(this, "resources", Resource);
    }

    owningApi() {
        return <raml.Api><any>this.owningFragment();
    }

    methods() {
        return mapArray<Method>(this, "methods", Method);
    }

    name() {
        return this.json.displayName;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_RESOURCE;
    }
}

export function loadApi(api: api.Api10): raml.Api {
    let nm = normalize(api);
    let collection = ts.parseJSONTypeCollection(nm);
    return new Api(api, collection);
}

export function loadLibrary(api: api.Library): raml.Library {
    let nm = normalize(api);
    let collection = ts.parseJSONTypeCollection(nm);
    return new Library(api, collection);
}

export function toTypeDeclaration(
    json:datamodel.TypeDeclaration,
    collection:ti.IParsedTypeCollection,
    defaultsToAny=false):ti.IParsedType{

    let td = normalizeType(json);
    let parsedType = ts.parseJsonTypeWithCollection("", td, collection, defaultsToAny);
    return parsedType;
}