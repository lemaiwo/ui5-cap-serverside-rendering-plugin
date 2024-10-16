namespace my.bookshop;

using { ServerSideRendering } from 'ui5-cap-serverside-rendering-plugin';

entity Books@(ServerSideRenderingType:'wrong'):ServerSideRendering {
  key ID : Integer;
  title  : String;
  stock  : Integer;
}
