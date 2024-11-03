namespace my.bookshop;

using { ServerSideRendering } from 'ui5-cap-serverside-rendering-plugin';

entity Books@(ServerSideRenderingType:'view'):ServerSideRendering {
  key ID : Integer;
  title  : String;
  stock  : Integer;
  to_author: Association to Authors;
}

entity Authors {
  key ID : Integer;
  name  : String;
}