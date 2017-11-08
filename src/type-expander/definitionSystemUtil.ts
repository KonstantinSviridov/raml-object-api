import typeSystem = require("../typesystem/parse");
import tsInterfaces = typeSystem.tsInterfaces;

const universes = require("../definition-system/universe");

export function propertiesForBuiltinTypes(builtInTypes: string[]):{[key:string]:boolean} {
    let types: any[] = [];
    for (let tn of builtInTypes) {
        let t = typeSystem.builtInTypes().get(tn);
        if (t) {
            let ts = mapType(t);
            ts.forEach(x => types.push(x));
        }
    }
    let propMap: any = {};
    types.forEach(x => {
        for(let y of Object.keys(x.properties)){
            propMap[x.properties[y].name] = true;
        }
    });
    return propMap;
}

export function mapType(pt:tsInterfaces.IParsedType):any[] {

    let result: any[] = [];
    if (pt.isString()) {
        result.push(universes.Universe10.StringTypeDeclaration);
    }
    else if (pt.isNumber()) {
        if (pt.isInteger()) {
            result.push(universes.Universe10.IntegerTypeDeclaration);
        }
        result.push(universes.Universe10.NumberTypeDeclaration);
    }
    else if (pt.isBoolean()) {
        result.push(universes.Universe10.BooleanTypeDeclaration);
    }
    else if (pt.isObject()) {
        result.push(universes.Universe10.ObjectTypeDeclaration);
    }
    else if (pt.isArray()) {
        result.push(universes.Universe10.ArrayTypeDeclaration);
    }
    else if (pt.isFile()) {
        result.push(universes.Universe10.FileTypeDeclaration);
    }
    else if (pt.isDateTime()) {
        result.push(universes.Universe10.DateTimeTypeDeclaration);
    }
    else if (pt.isDateTimeOnly()) {
        result.push(universes.Universe10.DateTimeOnlyTypeDeclaration);
    }
    else if (pt.isDateOnly()) {
        result.push(universes.Universe10.DateOnlyTypeDeclaration);
    }
    else if (pt.isTimeOnly()) {
        result.push(universes.Universe10.TimeOnlyTypeDeclaration);
    }
    if (pt.isUnion()) {
        result.push(universes.Universe10.UnionTypeDeclaration);
    }
    if (result.length == 0) {
        result.push(universes.Universe10.TypeDeclaration);
    }
    return result;
}


export class MetaNamesProvider{

    private static instance:MetaNamesProvider = new MetaNamesProvider();

    public static getInstance():MetaNamesProvider{
        if(!MetaNamesProvider.instance){
            MetaNamesProvider.instance = new MetaNamesProvider();
        }
        return MetaNamesProvider.instance;
    }

    constructor(){
        this.init();
    }

    private map:{[key:string]:boolean} = {};

    private init(){
        let types = [
            universes.Universe10.TypeDeclaration,
            universes.Universe10.StringTypeDeclaration,
            universes.Universe10.FileTypeDeclaration
        ];
        for(let t of types) {
            for (let key of Object.keys(t.properties)) {
                let pName = t.properties[key].name;
                if (pName != universes.Universe10.TypeDeclaration.properties.schema.name) {
                    this.map[pName] = true;
                }
            }
        }
        this.map["sourceMap"] = true;
        this.map["__METADATA__"] = true;
    }

    public hasProperty(n:string):boolean{
        return this.map.hasOwnProperty(n);
    }
}