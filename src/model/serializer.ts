import raml = require("./model-interfaces");
import ti = require("../typesystem-interfaces/typesystem-interfaces");
import api = require("../typings-new-format/spec-1.0/api");
import datamodel = require("../typings-new-format/spec-1.0/datamodel");
import resources = require("../typings-new-format/spec-1.0/resources");
import methods = require("../typings-new-format/spec-1.0/methods");
import security = require("../typings-new-format/spec-1.0/security");
import common = require("../typings-new-format/spec-1.0/common");
import api08 = require("../typings-new-format/spec-0.8/api");
import bodies08 = require("../typings-new-format/spec-0.8/bodies");
import parameters08 = require("../typings-new-format/spec-0.8/parameters");
import methods08 = require("../typings-new-format/spec-0.8/methods");
import resources08 = require("../typings-new-format/spec-0.8/resources");
import security08 = require("../typings-new-format/spec-0.8/security");
import common08 = require("../typings-new-format/spec-0.8/common");
import typeExpander = require("../type-expander/typeExpander");
import index = require("../index");

export class JsonSerializer{

    constructor(protected options:index.SerializeOptions={}){
        if(typeof(this.options.typeExpansionRecursionDepth) !== "number"){
            this.options.typeExpansionRecursionDepth = -1;
        }
        if(typeof(this.options.serializeMetadata) !== "boolean"){
            this.options.serializeMetadata = false;
        }
    }

    private serializationOptions():typeExpander.Options{
        let result:typeExpander.Options = {};
        for(let key of Object.keys(this.options)){
            result[key] = this.options[key];
        }
        return result;
    }

    serialize(_node:raml.Fragment|raml.Api08):Object{
        let nodeKind = _node.kind();
        let ramlVersion:string;
        let specBody:any = {};
        let depth = this.checkIfNeedExpand(nodeKind);
        if(nodeKind==raml.NodeKindMap.NODE_KIND_API_08){
            const apiNode = <raml.Api08>_node;
            specBody = this.serializeApi08(apiNode,specBody);
            ramlVersion  = "RAML08";
            nodeKind = raml.NodeKindMap.NODE_KIND_API;
        }
        else {
            ramlVersion  = "RAML10";
            let node = <raml.Fragment>_node;
            this.serializeFragment(node, specBody);

            if (nodeKind == raml.NodeKindMap.NODE_KIND_API) {
                const apiNode = <raml.Api10>node;
                specBody = this.serializeApi(apiNode, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_LIBRARY) {
                specBody = this.serializeLibrary(<raml.Library>node, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_EXTENSION) {
                specBody = this.serializeExtension(<raml.Extension>node, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_OVERLAY) {
                specBody = this.serializeOverlay(<raml.Overlay>node, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_RESOURCE_TYPE) {
                specBody = this.serializeResourceType(<raml.ResourceTypeFragment>node, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_TRAIT) {
                specBody = this.serializeTrait(<raml.TraitFragment>node, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_DEFINITION) {
                const ssFragment = <raml.SecuritySchemeFragment>node;
                nodeKind = ssFragment.actualKind();
                specBody = this.serializeSecuritySchemeDefinition(ssFragment, specBody);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_TYPE_DECLARATION) {
                let typeFragment = <raml.TypeFragment>node;
                nodeKind = typeFragment.actualKind();
                let serializedType = this.serializeTypeDeclaration(typeFragment.type(), typeFragment.isAnnotation());
                Object.keys(serializedType).forEach(x => specBody[x] = serializedType[x]);
            }
            else if (nodeKind == raml.NodeKindMap.NODE_KIND_EXAMPLE_SPEC) {
                specBody = this.serializeExampleSpec(<raml.ExampleSpecFragment>node, specBody);
            }
        }
        const result = {
            ramlVersion: ramlVersion,
            type: nodeKind,
            specification: specBody,
            errors: _node.errors()
        };
        this.options.typeExpansionRecursionDepth = depth;
        return result;
    }

    private checkIfNeedExpand(kind:string):number{
        let d = this.options.typeExpansionRecursionDepth;
        if(kind != raml.NodeKindMap.NODE_KIND_LIBRARY
            && kind != raml.NodeKindMap.NODE_KIND_EXTENSION
            && kind != raml.NodeKindMap.NODE_KIND_OVERLAY
            && kind != raml.NodeKindMap.NODE_KIND_API){
            this.options.typeExpansionRecursionDepth = -1;
        }
        return d;
    }

    serializeFragment(node:raml.Fragment,result:common.FragmentDeclaration){
        const uses = node.uses();
        if(uses&&uses.length){
            result.uses = uses.map(x=>this.serializeUssesDeclaration(x));
        }
    }

    serializeUssesDeclaration(node:raml.UsesDeclaration):common.UsesDeclaration{
        let result:common.UsesDeclaration = {
            key: node.key(),
            value: node.path()
        };
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeSources(node,result);
        return result;
    }

    serializeLibraryBase(node:raml.LibraryBase,result:api.LibraryBase10={}):api.LibraryBase10{
        this.serializeSources(node,<common.Annotable>result);
        const types = node.types();
        if(types&&types.length){
            result.types = types.map(x=>this.serializeTypeDeclaration(x));
        }
        const annotationTypes = node.annotationTypes();
        if(annotationTypes&&annotationTypes.length){
            result.annotationTypes = annotationTypes.map(x=>this.serializeTypeDeclaration(x,true));
        }
        const securitySchemes = node.securitySchemes();
        if(securitySchemes && securitySchemes.length){
            result.securitySchemes = securitySchemes.map(x=>this.serializeSecuritySchemeDefinition(x));
        }
        const traits = node.traits();
        if(traits && traits.length){
            result.traits = traits.map(x=>this.serializeTrait(x));
        }

        const resourceTypes = node.resourceTypes();
        if(resourceTypes && resourceTypes.length){
            result.resourceTypes = resourceTypes.map(x=>this.serializeResourceType(x));
        }
        return result;
    }

    serializeApi(node:raml.Api10, result:api.Api10=<api.Api10>{}):api.Api10{
        result.title = node.title();
        result.protocols = node.protocols();

        this.serializeLibraryBase(node,result);

        if(node.baseUri()!=null){
            result.baseUri = node.baseUri();
        }
        if(node.version()!=null){
            result.version = node.version();
        }
        if(node.description()!=null){
            result.description = node.description();
        }
        const documentation = node.documentation();
        if(documentation && documentation.length){
            result.documentation = documentation.map(x=>this.serializeDocumentation(x));
        }
        const resources = node.resources();
        if(resources && resources.length){
            result.resources = resources.map(x=>this.serializeResource(x));
        }
        this.serializeSecured(node,result);
        const mediaType = node.mediaType();
        if(mediaType && mediaType.length){
            result.mediaType = mediaType;
        }
        const baseUriParameters = node.baseUriParameters();
        if(baseUriParameters && baseUriParameters.length){
            result.baseUriParameters = baseUriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeApi08(node:raml.Api08, result:api08.Api08=<api08.Api08>{}):api08.Api08{
        result.title = node.title();
        if(node.version()!=null){
            result.version = node.version();
        }
        if(node.baseUri()!=null){
            result.baseUri = node.baseUri();
        }

        result.protocols = node.protocols();
        const mediaType = node.mediaType();
        if(mediaType && mediaType.length){
            result.mediaType = mediaType;
        }
        const baseUriParameters = node.baseUriParameters();
        if(baseUriParameters && baseUriParameters.length){
            result.baseUriParameters = baseUriParameters.map(x=>this.serializeParameter08(x));
        }

        const globalSchemas = node.schemas();
        if(globalSchemas&&globalSchemas.length){
            result["schemas"] = globalSchemas.map(x=>this.serializeGlobalSchema(x));
        }
        const securitySchemes = node.securitySchemes();
        if(securitySchemes && securitySchemes.length){
            result.securitySchemes = securitySchemes.map(x=>this.serializeSecuritySchemeDefinition08(x));
        }
        const traits = node.traits();
        if(traits && traits.length){
            result.traits = traits.map(x=>this.serializeTrait08(x));
        }
        const resourceTypes = node.resourceTypes();
        if(resourceTypes && resourceTypes.length){
            result.resourceTypes = resourceTypes.map(x=>this.serializeResourceType08(x));
        }
        this.serializeSecured08(node,result);

        const resources = node.resources();
        if(resources && resources.length){
            result.resources = resources.map(x=>this.serializeResource08(x));
        }
        const documentation = node.documentation();
        if(documentation && documentation.length){
            result.documentation = documentation.map(x=>this.serializeDocumentation08(x));
        }
        this.serializeSources08(node,result);
        return result;
    }

    serializeOverlay(node:raml.Overlay, result:api.Overlay=<api.Overlay>{}):api.Overlay{
        result.extends = node.extends();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeApi(node,result);
        return result;
    }

    serializeExtension(node:raml.Extension, result:api.Extension=<api.Extension>{}):api.Extension{
        result.extends = node.extends();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeApi(node,result);
        return result;
    }

    serializeSecured(node:{securedBy():raml.SecuredBy[]},result:{securedBy?:security.SecuritySchemeBase10[]}){
        const securedBy = node.securedBy();
        if(securedBy && securedBy.length){
            result.securedBy = securedBy.map(x=>x && this.serializeSecuritySchemeDefinition(x));
        }
    }

    serializeSecured08(node:{securedBy():raml.SecuredBy08[]},result:{securedBy?:security08.AbstractSecurityScheme08[]}){
        const securedBy = node.securedBy();
        if(securedBy && securedBy.length){
            result.securedBy = securedBy.map(x=>x && this.serializeSecuritySchemeDefinition08(x));
        }
    }

    serializeParameter(x:raml.Parameter10):datamodel.TypeDeclaration {
        const paramName = x.name();
        const bodyType = x.type();
        if(bodyType.name()&&this.options.typeExpansionRecursionDepth<0){
            const result:any = {
                name: paramName,
                displayName: paramName,
                type: [ bodyType.name() ],
                required: x.required(),
                typePropertyKind: "TYPE_EXPRESSION",
                __METADATA__: {
                    primitiveValuesMeta: {
                        displayName: {
                            calculated: true
                        }
                    }
                }
            };
            if(x.meta()){
                result.__METADATA__ = x.meta();
            }
            // if(bodyType.name().indexOf(">>")>0) {
            //     bodyType.allFacets().forEach(x => {
            //         if (x.kind() == ti.MetaInformationKind.ParserMetadata
            //             || x.kind() == ti.MetaInformationKind.SourceMap) {
            //             result[x.facetName()] = x.value();
            //         }
            //     });
            // }
            return result
        }
        let t = this.serializeTypeDeclaration(bodyType,false,x.isInsideTemplate());
        if(!t.name){
            t.name = paramName;
        }
        else if (t.name != paramName) {
            t = <any>{
                name: paramName,
                type: [t]
            }
        }
        if(t.displayName==null){
            t.displayName = t.name;
        }
        t.required = x.required();
        if(x.meta()){
            t.__METADATA__ = x.meta();
        }
        return t;
    }

    serializeParameter08(node:raml.Parameter08):parameters08.Parameter08 {

        let result:parameters08.Parameter08 = {
            name: node.name(),
            type: node.type(),
            required: node.required()
        };

        if(node.displayName()!=null) {
            result.displayName = node.displayName();
        }
        if(node.default()!==undefined) {
            result.default = node.default();
        }
        if(node.example() != null){
            result.example = node.example();
        }
        if(node.repeat()!=null){
            result.repeat = node.repeat();
        }
        if(node.description() != null){
            result.description = node.description();
        }
        if(node.pattern()!=null){
            (<parameters08.StringTypeDeclaration08>result).pattern = node.pattern();
        }
        if(node.enum()!=null){
            (<parameters08.StringTypeDeclaration08>result).enum = node.enum();
        }
        if(node.minLength()!=null){
            (<parameters08.StringTypeDeclaration08>result).minLength = node.minLength();
        }
        if(node.maxLength()!=null){
            (<parameters08.StringTypeDeclaration08>result).maxLength = node.maxLength();
        }
        if(node.minimum()!=null){
            (<parameters08.NumberTypeDeclaration08>result).minimum = node.minimum();
        }
        if(node.maximum()!=null){
            (<parameters08.NumberTypeDeclaration08>result).maximum = node.maximum();
        }
        this.serializeSources08(node,result);
        return result;
    }

    serializeAnnotation(node:raml.IAnnotation):common.AnnotationInstance {
        const result = {
            name: node.name(),
            value: node.value()
        };
        return result;
    }

    serializeSources(node:raml.HasSource10, result:common.Annotable={}):common.HasSource {
        this.serializeAnnotated(node,<common.Annotable>result);
        if(this.options.sourceMap&&node.sourceMap()){
            result.sourceMap = node.sourceMap();
        }
        if(this.options.serializeMetadata&&node.metadata()){
            result.__METADATA__ = node.metadata();
        }
        if(node.isInsideTemplate()){
            let pPart = node.parametrizedPart();
            if(pPart){
                for(let key of Object.keys(pPart)){
                    result[key] = pPart[key];
                }
            }
        }
        return result;
    }

    serializeSources08(node:raml.HasSource08, result:common08.HasSource={}):common08.HasSource {
        if(this.options.sourceMap&&node.sourceMap()){
            result.sourceMap = node.sourceMap();
        }
        if(this.options.serializeMetadata&&node.metadata()){
            result.__METADATA__ = node.metadata();
        }
        if(node.isInsideTemplate()){
            let pPart = node.parametrizedPart();
            if(pPart){
                Object.keys(pPart).forEach(x=>result[x]=pPart[x]);
            }
        }
        return result;
    }

    serializeAnnotated(node:raml.IAnnotated, result:common.Annotable={}):common.Annotable {
        const annotations = node.annotations();
        if(annotations && annotations.length){
            result.annotations = node.annotations().map(x=>this.serializeAnnotation(x));
        }
        const scalarsAnnotations = node.scalarsAnnotations();
        if(scalarsAnnotations){
            const fNames = Object.keys(scalarsAnnotations);
            if(fNames.length) {
                result.scalarsAnnotations = {};
                for (let fName of fNames) {
                    result.scalarsAnnotations[fName] = scalarsAnnotations[fName].map(x => x.map(y => this.serializeAnnotation(y)));
                }
            }
        }
        return result;
    }

    serializeBody(x:raml.Body10):datamodel.TypeDeclaration {
        const mimeType = x.mimeType();
        const bodyType = x.type();
        // if(this.options.typeExpansionRecursionDepth<0
        //     && bodyType.superTypes().filter(x=>x.name()=="union"||x.name()=="array"||x.name()==null).length==0){
        //     const result:any = {
        //         name: mimeType,
        //         displayName: mimeType,
        //         type: bodyType.superTypes().map(x=>x.name()),
        //         typePropertyKind: "TYPE_EXPRESSION",
        //         __METADATA__: {
        //             primitiveValuesMeta: {
        //                 displayName: {
        //                     calculated: true
        //                 }
        //             }
        //         }
        //     };
        //     let typeMeta = bodyType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata);
        //     if(x.meta()){
        //         result.__METADATA__ = x.meta();
        //     }
        //     else if(bodyType.name().indexOf("<<")>=0&&typeMeta.length){
        //         result.__METADATA__ = typeMeta[0].value();
        //     }
        //     // if(bodyType.name().indexOf(">>")>0) {
        //     //     bodyType.allFacets().forEach(x => {
        //     //         if (x.kind() == ti.MetaInformationKind.SourceMap) {
        //     //             result[x.facetName()] = x.value();
        //     //         }
        //     //     });
        //     // }
        //     return result
        // }
        let t = this.serializeTypeDeclaration(bodyType,false,x.isInsideTemplate());
        if(!t.name){
            t.name = mimeType;
        }
        else if (t.name != mimeType) {
            t = <any>{
                name: mimeType,
                type: [t]
            }
        }
        if(t.displayName==null){
            t.displayName = t.name;
        }
        return t;
    }

    serializeBody08(node:raml.BodyLike08):bodies08.BodyLike08 {
        let result:bodies08.BodyLike08 = {
            name: node.name()
        };
        if(node.schema()!=null){
            result.schema = node.schema();
        }
        if(node.example()!=null){
            result.example = node.example();
        }
        let formParameters = node.formParameters();
        if(formParameters && formParameters.length){
            result.formParameters = formParameters.map(x=>this.serializeParameter08(x));
        }
        if(node.schemaContent()) {
            result.schemaContent = node.schemaContent();
        }
        if(node.description()) {
            result.description = node.description();
        }
        this.serializeSources08(node,result);
        return result;
    }

    serializeDocumentation(node:raml.Documentation10):api.DocumentationItem{
        const result:api.DocumentationItem = {
            title: node.title(),
            content: node.content()
        };
        this.serializeSources(node,result);
        return result;
    }

    serializeDocumentation08(node:raml.Documentation08):api08.DocumentationItem08{
        const result:api08.DocumentationItem08 = {
            title: node.title(),
            content: node.content()
        };
        this.serializeSources08(node,result);
        return result;
    }

    serializeResponse(node:raml.Response10):methods.Response10{
        const result:methods.Response10 = {
            code: node.code()
        };
        if(node.description()!=null){
            result.description = node.description();
        }
        this.serializeSources(node,result);
        const headers = node.headers();
        if(headers&&headers.length){
            result.headers = headers.map(x=>this.serializeParameter(x));
        }
        let bodies = node.bodies();
        if(bodies && bodies.length){
            result.body = bodies.map(x=>this.serializeBody(x));
        }
        return result;
    }

    serializeResponse08(node:raml.Response08):bodies08.Response08{
        const result:bodies08.Response08 = {
            code: node.code()
        };
        if(node.description()!=null){
            result.description = node.description();
        }
        this.serializeSources08(node,result);
        const headers = node.headers();
        if(headers&&headers.length){
            result.headers = headers.map(x=>this.serializeParameter08(x));
        }
        let bodies = node.bodies();
        if(bodies && bodies.length){
            result.body = bodies.map(x=>this.serializeBody08(x));
        }
        return result;
    }

    serializeSecuritySchemePart(node:raml.SecuritySchemePart10, result:security.SecuritySchemePart10={}):security.SecuritySchemePart10{
        this.serializeOperation(node,result);
        return result;
    }

    serializeSecuritySchemePart08(node:raml.SecuritySchemePart08,result:security08.SecuritySchemePart08=<any>{}):security08.SecuritySchemePart08{
        this.serializeMethodBase08(node,result);
        if(node.is()&&node.is().length){
            result.is = node.is().map(x=>this.serializeTemplateReference(x));
        }
        return result;
    }

    serializeOperation(node:raml.Operation,result:methods.Operation10={}):methods.Operation10{

        this.serializeSources(node,result);

        const parameters = node.parameters();
        if(parameters && parameters.length){
            let queryParameters:raml.Parameter10[] = [];
            let headers:raml.Parameter10[] = [];
            let queryString:raml.Parameter10[] = [];
            let uriParameters:raml.Parameter10[] = [];
            for(let p of parameters){
                const location = p.location();
                if(location=="query"){
                    queryParameters.push(p);
                }
                else if(location=="headers"){
                    headers.push(p);
                }
                else if(location=="queryString"){
                    queryString.push(p);
                }
                else if(location=="uriParameters"){
                    uriParameters.push(p);
                }
            }
            if(queryParameters.length){
                result.queryParameters = queryParameters.map(x=>this.serializeParameter(x));
            }
            if(headers.length){
                result.headers = headers.map(x=>this.serializeParameter(x));
            }
            if(queryString.length){
                result.queryString = this.serializeParameter(queryString[0]);
            }
        }
        const responses = node.responses();
        if(responses&&responses.length){
            result.responses = responses.map(x=>this.serializeResponse(x));
        }
        return result;
    }

    serializeMethodBase(node:raml.MethodBase10, result:methods.MethodBase10={}):methods.MethodBase10{

        if(node.is()&&node.is().length){
            result.is = node.is().map(x=>this.serializeTemplateReference(x));
        }

        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.description()!=null){
            result.description = node.description();
        }
        if(node.protocols()&&node.protocols().length){
            result.protocols = node.protocols();
        }
        this.serializeOperation(node,result);
        const bodies = node.bodies();
        if(bodies&&bodies.length){
            result.body = bodies.map(x=>this.serializeBody(x));
        }
        this.serializeSecured(node,result);
        return result;
    }

    serializeMethodBase08(node:raml.MethodBase08, result:methods08.MethodBase08=<any>{}):methods08.MethodBase08{


        if(node.description()!=null){
            result.description = node.description();
        }
        if(node.protocols()&&node.protocols().length){
            result.protocols = node.protocols();
        }
        this.serializeSources08(node,result);

        const parameters = node.parameters();
        if(parameters && parameters.length){
            let queryParameters:raml.Parameter08[] = [];
            let headers:raml.Parameter08[] = [];
            let queryString:raml.Parameter08[] = [];
            let uriParameters:raml.Parameter08[] = [];
            for(let p of parameters){
                const location = p.location();
                if(location=="query"){
                    queryParameters.push(p);
                }
                else if(location=="headers"){
                    headers.push(p);
                }
                else if(location=="queryString"){
                    queryString.push(p);
                }
                else if(location=="uriParameters"){
                    uriParameters.push(p);
                }
            }
            if(queryParameters.length){
                result.queryParameters = queryParameters.map(x=>this.serializeParameter08(x));
            }
            if(headers.length){
                result.headers = headers.map(x=>this.serializeParameter08(x));
            }
        }
        const responses = node.responses();
        if(responses&&responses.length){
            result.responses = responses.map(x=>this.serializeResponse08(x));
        }
        const bodies = node.body();
        if(bodies&&bodies.length){
            result.body = bodies.map(x=>this.serializeBody08(x));
        }
        this.serializeSecured08(node,result);
        return result;
    }

    serializeMethod(node:raml.Method10):methods.Method10{

        const method = node.method();
        const result:methods.Method10 = {
            method: method
        };
        if(node.resource()){
            result.parentUri = node.resource().completeRelativeUri();
            result.absoluteParentUri = node.resource().absoluteUri();
        }
        this.serializeMethodBase(node,result);
        const uriParameters = node.parameters().filter(x=>x.location()=="uriParameters");
        if(uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeMethod08(node:raml.Method08):methods08.Method08{

        const method = node.method();
        const result:methods08.Method08 = <any>{
            method: method
        };
        if(node.resource()){
            result.parentUri = node.resource().completeRelativeUri();
            result.absoluteParentUri = node.resource().absoluteUri();
        }
        if(node.is()&&node.is().length){
            result.is = node.is().map(x=>this.serializeTemplateReference(x));
        }
        this.serializeMethodBase08(node,result);
        const uriParameters = node.parameters().filter(x=>x.location()=="uriParameters");
        if(uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter08(x));
        }
        return result;
    }

    serializeTrait(node:raml.Trait10, result=<methods.Trait10>{}):methods.Trait10{

        result.name = node.name();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeMethodBase(node,result);
        return result;
    }

    serializeTrait08(node:raml.Trait08, result:methods08.Trait=<any>{}):methods08.Trait{

        result.name = node.name();
        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeMethodBase08(node,result);
        return result;
    }


    serializeLibrary(node:raml.Library, result:api.Library={}):api.Library{
        this.serializeLibraryBase(node,result);
        if(node.usage()!=null){
            result.usage = node.usage();
        }
        return result;
    }

    serializeSecuritySchemeDefinition(node:raml.SecuritySchemeDefinition10, result = <security.SecuritySchemeBase10>{}):security.SecuritySchemeBase10{

        result.name = node.name();
        result.type = node.type();
        if(node.description()){
            result.description = node.description();
        }
        if(node.describedBy()){
            result.describedBy = this.serializeSecuritySchemePart(node.describedBy());
        }
        if(node.settings()){
            result.settings = node.settings();
        }
        this.serializeSources(node,result);
        return result;
    }

    serializeSecuritySchemeDefinition08(node:raml.SecuritySchemeDefinition08, result = <security08.AbstractSecurityScheme08>{}):security08.AbstractSecurityScheme08{

        result.name = node.name();
        result.type = node.type();
        if(node.description()){
            result.description = node.description();
        }
        if(node.describedBy()){
            result.describedBy = this.serializeSecuritySchemePart08(node.describedBy());
        }
        if(node.settings()){
            result.settings = node.settings();
        }
        this.serializeSources08(node,result);
        return result;
    }

    serializeResourceBase(node:raml.ResourceBase10, result:resources.ResourceBase10={}):resources.ResourceBase10{

        if(node.type()){
            result.type = this.serializeTemplateReference(node.type());
        }

        if(node.is()&&node.is().length){
            result.is = node.is().map(x=>this.serializeTemplateReference(x));
        }

        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.description()){
            result.description = node.description();
        }
        this.serializeSources(node,result);
        const methods = node.methods();
        if(methods&&methods.length){
            result.methods = methods.map(x=>this.serializeMethod(x));
        }
        this.serializeSecured(node,result);
        const uriParameters = node.uriParameters();
        if(uriParameters&&uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeResourceBase08(node:raml.ResourceBase08, result:resources08.ResourceBase08={}):resources08.ResourceBase08{

        if(node.type()){
            result.type = this.serializeTemplateReference(node.type());
        }

        if(node.is()&&node.is().length){
            result.is = node.is().map(x=>this.serializeTemplateReference(x));
        }

        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.description()){
            result.description = node.description();
        }
        this.serializeSources08(node,result);
        const methods = node.methods();
        if(methods&&methods.length){
            result.methods = methods.map(x=>this.serializeMethod08(x));
        }
        this.serializeSecured08(node,result);
        const uriParameters = node.uriParameters();
        if(uriParameters&&uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter08(x));
        }
        return result;
    }

    serializeResource(node:raml.Resource10):resources.Resource10{
        const result:resources.Resource10 = {
            relativeUri: node.relativeUri(),
            completeRelativeUri: node.completeRelativeUri(),
            absoluteUri: node.absoluteUri(),
            relativeUriPathSegments: []
        };
        this.serializeResourceBase(node,result);
        const resources = node.resources();
        if(resources && resources.length) {
            result.resources = resources.map(x=>this.serializeResource(x));
        }
        result.completeRelativeUri = node.completeRelativeUri();
        result.absoluteUri = node.absoluteUri();
        result.parentUri = node.parentUri();
        result.absoluteParentUri = node.absoluteParentUri();
        const relativeUriPathSegments = node.relativeUriPathSegments();
        if(relativeUriPathSegments&&relativeUriPathSegments.length){
            result.relativeUriPathSegments = relativeUriPathSegments;
        }
        const uriParameters = node.allUriParameters();
        if(uriParameters&&uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeResource08(node:raml.Resource08):resources08.Resource08{
        const result:resources08.Resource08 = {
            relativeUri: node.relativeUri(),
            completeRelativeUri: node.completeRelativeUri(),
            absoluteUri: node.absoluteUri(),
            relativeUriPathSegments: []
        };
        this.serializeResourceBase08(node,result);
        const resources = node.resources();
        if(resources && resources.length) {
            result.resources = resources.map(x=>this.serializeResource08(x));
        }
        result.completeRelativeUri = node.completeRelativeUri();
        result.absoluteUri = node.absoluteUri();
        result.parentUri = node.parentUri();
        result.absoluteParentUri = node.absoluteParentUri();
        const relativeUriPathSegments = node.relativeUriPathSegments();
        if(relativeUriPathSegments&&relativeUriPathSegments.length){
            result.relativeUriPathSegments = relativeUriPathSegments;
        }
        const uriParameters = node.allUriParameters();
        if(uriParameters&&uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter08(x));
        }
        return result;
    }

    serializeResourceType(node:raml.ResourceType10, result = <resources.ResourceType10>{}):resources.ResourceType10{

        result.name = node.name();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeResourceBase(node,result);
        return result;
    }

    serializeResourceType08(node:raml.ResourceType08,result = <resources08.ResourceType08>{}):resources08.ResourceType08{

        result.name = node.name();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeResourceBase08(node,result);
        return result;
    }

    serializeTypeDeclaration(node:ti.IParsedType,isAnnotaionType=false,isInsideTemplate=false):datamodel.TypeDeclaration{
        let options = this.serializationOptions();
        options.isAnnotationType = isAnnotaionType;
        options.isInsideTemplate = isInsideTemplate;
        return new typeExpander.TypeExpander(options).serializeType(node);
    }

    serializeTemplateReference(node:raml.TemplateReference):methods.TemplateReference{
        const result:methods.TemplateReference = {
            name: node.name()
        }
        if(node.parameters()){
            result.parameters = node.parameters();
        }
        return result;
    }

    serializeExampleSpec(node:raml.ExampleSpecFragment,result:datamodel.ExampleSpec10=<any>{}){

        result.name = node.name();
        if(node.displayName()){
            result.displayName = node.displayName();
        }
        result.value = node.value();
        result.strict = node.strict();
        if(node.description()){
            result.description = node.description();
        }
        this.serializeSources(node,result);
        return result;
    }

    serializeGlobalSchema(node:raml.GlobalSchema):api08.GlobalSchema{
        let result:api08.GlobalSchema = {
            name: node.name(),
            value: node.schemaValue()
        }
        if(node.sourceMap()){
            result.sourceMap = node.sourceMap();
        }
        return result;
    }

}