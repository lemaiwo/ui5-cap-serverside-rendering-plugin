aspect ServerSideRendering @(ServerSideRendering){
    virtual fileName  : String;
    virtual mediaType : String      @Core.IsMediaType;
    virtual content   : LargeBinary @Core.MediaType: mediaType;
}
