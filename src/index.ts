export import modelInterfaces = require("./model/model-interfaces");
export import modelImpl = require("./model/model-impl");
export import serializer = require("./model/serializer");
export import typesystem = require("./typesystem/parse");
export import tsInterfaces = typesystem.tsInterfaces;

export function buildModel(json:any):modelInterfaces.Fragment{
    return modelImpl.load(json);
}

export interface SerializeOptions{

    typeExpansionRecursionDepth?: number
}

export function expandTypes(json:any, options:SerializeOptions):any{
    options = options || {};
    const model = buildModel(json);
    return new serializer.JsonSerializer(options.typeExpansionRecursionDepth).serialize(model);
}