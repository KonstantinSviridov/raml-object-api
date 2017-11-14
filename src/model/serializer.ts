import raml = require("./model-interfaces");
import ti = require("../typesystem-interfaces/typesystem-interfaces");
import api = require("../typings-new-format/spec-1.0/api");
import datamodel = require("../typings-new-format/spec-1.0/datamodel");
import resources = require("../typings-new-format/spec-1.0/resources");
import methods = require("../typings-new-format/spec-1.0/methods");
import security = require("../typings-new-format/spec-1.0/security");
import common = require("../typings-new-format/spec-1.0/common");
import typeExpander = require("../type-expander/typeExpander");

export class JsonSerializer{

    constructor(protected recursionDepth=-1){}

    serialize(node:raml.Fragment):Object{
        let specBody:any = {};
        this.serializeFragment(node,specBody);
        let nodeKind = node.kind();
        if(nodeKind==raml.NodeKindMap.RAML_KIND_API){
            specBody = this.serializeApi(<raml.Api>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_LIBRARY){
            specBody = this.serializeLibrary(<raml.Library>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_EXTENSION){
            specBody = this.serializeExtension(<raml.Extension>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_OVERLAY){
            specBody = this.serializeOverlay(<raml.Overlay>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_RESOURCE_TYPE){
            specBody = this.serializeResourceType(<raml.ResourceTypeFragment>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_TRAIT){
             specBody = this.serializeTrait(<raml.TraitFragment>node,specBody);
        }
        else if(nodeKind==raml.NodeKindMap.RAML_KIND_SECURITY_SCHEME_DEFINITION){
            specBody = this.serializeSecuritySchemeDefinition(<raml.SecuritySchemeFragment>node,specBody);
        }
        const result = {
            ramlVersion: "RAML10",
            type: nodeKind,
            specification: specBody
        };
        return result;
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

    serializeApi(node:raml.Api, result:api.Api10=<api.Api10>{}):api.Api10{
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

    serializeParameter(x:raml.Parameter):datamodel.TypeDeclaration {
        const paramName = x.name();
        const bodyType = x.type();
        if(bodyType.name()&&this.recursionDepth<0){
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
        let t = this.serializeTypeDeclaration(bodyType,false);
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

    serializeAnnotation(node:raml.IAnnotation):common.AnnotationInstance {
        const result = {
            name: node.name(),
            value: node.value()
        };
        return result;
    }

    serializeSources(node:raml.HasSource, result:common.Annotable={}):common.HasSource {
        this.serializeAnnotated(node,<common.Annotable>result);
        if(node.sourceMap()){
            result.sourceMap = node.sourceMap();
        }
        if(node.metadata()){
            result.__METADATA__ = node.metadata();
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

    serializeBody(x:raml.Body):datamodel.TypeDeclaration {
        const mimeType = x.mimeType();
        const bodyType = x.type();
        if(bodyType.name()&&this.recursionDepth<0){
            const result:any = {
                name: mimeType,
                displayName: mimeType,
                type: [ bodyType.name() ],
                typePropertyKind: "TYPE_EXPRESSION",
                __METADATA__: {
                    primitiveValuesMeta: {
                        displayName: {
                            calculated: true
                        }
                    }
                }
            };
            let typeMeta = bodyType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata);
            if(x.meta()){
                result.__METADATA__ = x.meta();
            }
            else if(bodyType.name().indexOf("<<")>=0&&typeMeta.length){
                result.__METADATA__ = typeMeta[0].value();
            }
            // if(bodyType.name().indexOf(">>")>0) {
            //     bodyType.allFacets().forEach(x => {
            //         if (x.kind() == ti.MetaInformationKind.SourceMap) {
            //             result[x.facetName()] = x.value();
            //         }
            //     });
            // }
            return result
        }
        let t = this.serializeTypeDeclaration(bodyType);
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

    serializeDocumentation(node:raml.Documentation):api.DocumentationItem{
        const result = {
            title: node.title(),
            content: node.content()
        };
        this.serializeSources(node,<common.Annotable>result);
        return result;
    }

    serializeResponse(node:raml.Response):methods.Response10{
        const result:methods.Response10 = {
            code: node.code()
        };
        if(node.description()!=null){
            result.description = node.description();
        }
        this.serializeSources(node,<common.Annotable>result);
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
    serializeSecuritySchemePart(node:raml.SecuritySchemePart,result:security.SecuritySchemePart10={}):security.SecuritySchemePart10{
        this.serializeOperation(node,result);
        return result;
    }

    serializeOperation(node:raml.Operation,result:methods.Operation10={}):methods.Operation10{

        this.serializeSources(node,result);

        const parameters = node.parameters();
        if(parameters && parameters.length){
            let queryParameters:raml.Parameter[] = [];
            let headers:raml.Parameter[] = [];
            let queryString:raml.Parameter[] = [];
            let uriParameters:raml.Parameter[] = [];
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

    serializeMethodBase(node:raml.MethodBase,result:methods.MethodBase10={}):methods.MethodBase10{

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

    serializeMethod(node:raml.Method):methods.Method10{

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

    serializeTrait(node:raml.Trait,result=<methods.Trait10>{}):methods.Trait10{

        result.name = node.name();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeMethodBase(node,result);
        return result;
    }

    serializeLibrary(node:raml.Library, result:api.Library={}):api.Library{
        this.serializeLibraryBase(node,result);
        if(node.usage()!=null){
            result.usage = node.usage();
        }
        return result;
    }

    serializeSecuritySchemeDefinition(node:raml.SecuritySchemeDefinition, result = <security.SecuritySchemeBase10>{}):security.SecuritySchemeBase10{

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

    serializeResourceBase(node:raml.ResourceBase, result:resources.ResourceBase10={}):resources.ResourceBase10{

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

    serializeResource(node:raml.Resource):resources.Resource10{
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

    serializeResourceType(node:raml.ResourceType,result = <resources.ResourceType10>{}):resources.ResourceType10{

        result.name = node.name();
        if(node.usage()){
            result.usage = node.usage();
        }
        this.serializeResourceBase(node,result);
        return result;
    }

    serializeTypeDeclaration(node:ti.IParsedType,isAnnotaionType=false):datamodel.TypeDeclaration{
        return new typeExpander.TypeExpander().serializeType(node,this.recursionDepth,isAnnotaionType);
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

}