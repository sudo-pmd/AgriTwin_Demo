/**
 * Fond satellite commun aux cartes AgriTwin.
 *
 * Esri World Imagery ne couvre pas les zones rurales au-delà du niveau 17 :
 * les niveaux 18 et 19 renvoient une tuile identique « Map data not yet
 * available » (2,5 ko). On garde donc le zoom utilisateur jusqu'à 19, mais
 * au-delà de 17 Leaflet agrandit la dernière tuile réelle au lieu d'en
 * demander une inexistante.
 */
export const SAT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SAT_ATTRIBUTION = 'Imagerie &copy; Esri, Maxar, Earthstar Geographics';

export const SAT_MAX_ZOOM = 18;
export const SAT_MAX_NATIVE_ZOOM = 17;
