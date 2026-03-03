# Theatarr — Idees de fonctionnalites

## Billetterie & Accueil

- [ ] **Tickets QR Code** : generation d'un billet visuel (affiche du film, date, place, nom) avec QR code unique. Scannable a l'entree via le portail admin ou un mode kiosk dedie
- [ ] **Check-in automatique** : quand l'utilisateur scanne son QR, declenchement d'un evenement (message de bienvenue personnalise sur le wallmount, compteur de participants en temps reel, notification admin)
- [ ] **Places numerotees** : plan de salle configurable par l'admin (grille de sieges), choix de place au moment de l'acceptation d'invitation. Affichage du plan sur le wallmount avec places occupees/libres
- [ ] **Mode kiosk / borne d'accueil** : ecran dedie a l'entree avec scan QR, affichage du billet valide, animation de bienvenue

## Requetes & Suggestions

- [ ] **Boite a suggestions** : les utilisateurs proposent des films (recherche TMDB integree), les autres votent avec upvote/downvote. L'admin pioche dans les suggestions populaires pour creer des sessions
- [ ] **Wishlist personnelle** : chaque utilisateur maintient sa liste de films a voir, visible par l'admin pour planifier. Possibilite de marquer "vu" automatiquement apres une session
- [ ] **Recommendation engine** : suggestions basees sur l'historique des sessions + notes des utilisateurs via TMDB (genres, realisateurs, acteurs en commun). Affichage "Vous pourriez aimer..." sur le portail
- [ ] **Requete de session** : un utilisateur peut demander a l'admin d'organiser une session pour un film specifique, avec un systeme de notifications et suivi de la demande

## Gamification & Fidelite

- [ ] **Badges & Achievements** : systeme de badges deblocables affiches sur le profil
  - "Premier vote" — a vote pour la premiere fois
  - "Cinephile" — 10 sessions assistees
  - "Critique" — a note 20 films
  - "Noctambule" — session apres minuit
  - "Globe-trotter" — films de 10 pays differents
  - "Marathonien" — 3 sessions dans la meme semaine
  - "Quizmaster" — score parfait a un quiz
  - "Fidele" — present a 10 sessions consecutives
  - "Explorateur" — vu tous les genres disponibles
  - "Pionnier" — premier a accepter une invitation
- [ ] **Classement saisonnier** : points gagnes par participation, votes, quiz corrects. Classement mensuel/annuel avec podium. Reset chaque saison
- [ ] **Challenges thematiques** : defis temporaires configurables par l'admin
  - "Octobre horrifique" — 5 films d'horreur en octobre
  - "Marathon Nolan" — voir tous les Nolan disponibles
  - "Tour du monde" — 1 film par pays
  - Progression trackee avec barre de progression sur le portail
- [ ] **Pronostics** : avant une session mystere, les utilisateurs devinent le film parmi des indices. Points bonus si correct. Classement des meilleurs pronostiqueurs
- [ ] **Streaks** : compteur de sessions consecutives assistees, avec badges speciaux pour les longues series
- [ ] **Niveaux & Experience (XP)** : systeme RPG-like avec barres de progression
  - XP gagnes : assister (+50), voter (+20), quiz score parfait (+100), suggerer un film (+10), noter (+15)
  - Niveaux : Figurant → Spectateur → Cinephile → Critique → Realisateur → Legende
  - Chaque niveau debloque un cadre/bordure de profil unique
- [ ] **Cartes a collectionner** : chaque film vu genere une "carte" avec l'affiche, les stats de la session, et une rarete (commune, rare, epique, legendaire basee sur la note TMDB ou le nombre de participants). Collection visible sur le profil
- [ ] **Duels de quiz** : defi 1v1 entre deux participants sur des questions cine. Classement Elo dedie
- [ ] **Blind test musical** : quiz audio avec les bandes originales des films vus en session. Le plus rapide a reconnaitre gagne
- [ ] **Film Bingo** : grille de bingo generee aleatoirement avec des situations cine (quelqu'un pleure, twist final, scene post-generique, explosion, etc.). Les spectateurs cochent en temps reel pendant le film, premier bingo gagne
- [ ] **Paris cinematographiques** : avant une session, parier sur des elements du film (le heros survit ? note > 7 ? duree > 2h ?). Points selon les resultats
- [ ] **Trophees de salle** : recompenses collectives pour le groupe (100 films vus ensemble, 1000h de visionnage, tous les genres couverts). Affichables sur le wallmount en permanence
- [ ] **Saisons competitives** : saisons de 3 mois avec classement, recompenses pour le top 3 (choix du prochain film, badge exclusif, place VIP...)
- [ ] **Daily challenge** : un defi quotidien sur le portail (reconnaitre un film a partir d'un screenshot, deviner l'annee de sortie, associer acteur-film...). Score cumule
- [ ] **Parrainage** : inviter un nouvel utilisateur donne un bonus XP au parrain et au filleul. Badge "Ambassadeur"

## Experience en salle

- [ ] **Sequence pre-show automatisee** : scenario configurable par l'admin
  - T-15min : countdown "la seance commence dans..." sur le wallmount
  - T-5min : bandes-annonces automatiques
  - T-0 : extinction lumieres, demarrage film
  - Tout orchestre via les sequences existantes
- [ ] **Intermission** : timer de pause configurable avec countdown sur wallmount, musique d'ambiance, relance automatique a la fin du timer. Utile pour les films longs (>2h30)
- [ ] **Reactions live** : pendant/apres le film, boutons emoji rapides sur le portail mobile (applaudissements, rires, peur, larmes, wow). Agregees en temps reel sur le wallmount sous forme de bulles animees
- [ ] **Ambiance par genre** : profils d'eclairage/couleur lies au genre du film (rouge pour horreur, bleu pour sci-fi, dore pour drame, vert pour nature/aventure) via les adaptateurs existants. Configurable par l'admin
- [ ] **Mode "silence"** : notification push aux retardataires "la seance a commence, merci de mettre votre telephone en silencieux"
- [ ] **Applaudimetre** : a la fin du film, les spectateurs "applaudissent" via leur telephone, le wallmount affiche une jauge en temps reel
- [ ] **Generique interactif** : pendant le generique de fin, affichage sur le wallmount des notes en temps reel, citations preferees, meilleur moment vote live
- [ ] **Reveil doux** : si le film se termine tard, transition progressive vers un eclairage doux, musique calme, affichage "Merci pour cette soiree" sur le wallmount
- [ ] **Countdown cinematographique** : avant le film, affichage style "Feature Presentation" avec animation vintage (rideaux qui s'ouvrent, compte a rebours pellicule)
- [ ] **Annonces personnalisees** : messages pre-film style cinema ("Merci de ne pas filmer", "Bon film a tous!") mais avec les noms des participants ("Ce soir, [Prenom1], [Prenom2] et [Prenom3] vous presentent...")
- [ ] **Ambiance sonore d'attente** : playlist musicale automatique basee sur le genre du film diffusee avant la seance (jazz pour un film noir, synthwave pour du sci-fi 80s, orchestre pour un blockbuster)
- [ ] **Mode "Scene mythique"** : l'admin peut marquer des timestamps dans le film. A ces moments, effets lumineux ou haptic feedback sur les telephones des spectateurs (flash pour une explosion, vibration pour un jumpscare)
- [ ] **Photo de groupe automatique** : countdown + flash avant le film, photo affichee dans la galerie de la session
- [ ] **Debriefing guide** : apres le film, le portail propose des questions de discussion adaptees au film (themes, fin alternative, comparaison avec le livre...) pour animer le debrief
- [ ] **Second ecran enrichi** : pendant le film, infos contextuelles optionnelles sur le telephone (acteur en scene, lieu de tournage, anecdote) synchronisees avec la timeline du film — mode opt-in pour ne pas deranger
- [ ] **Effets atmospheriques** : integration avec des machines a fumee, ventilateurs, diffuseurs de parfum synchronises avec le film (odeur de pop-corn pendant une scene de cinema, brise marine pour une scene de plage) — pour les setups avances

## Organisation & Logistique

- [ ] **Sessions recurrentes** : "Vendredi cine" chaque semaine/mois, creation automatique de session avec rotation des suggestions ou pioche dans la wishlist collective
- [ ] **Sync calendrier** : export iCal / ajout Google Calendar / Apple Calendar depuis le portail quand on accepte une invitation. Mise a jour automatique si la session change
- [ ] **Bar & Snacks** : menu configurable par l'admin (popcorn, boissons, etc.). Les participants indiquent ce qu'ils apportent ou commandent. L'admin voit le recap avant la session
- [ ] **Meteo cine** : widget sur le portail home qui suggere "Soiree ideale pour un film" base sur la meteo locale (pluie = soiree cocooning, beau temps = seance en plein air si projecteur exterieur)
- [ ] **Covoiturage** : pour les home cinema avec amis, les participants peuvent proposer/demander des places en voiture
- [ ] **RSVP avance** : systeme de confirmation avec rappels automatiques (J-2, J-1, H-2) par notification push ou email

## Contenu & Medias

- [ ] **Cine-club / Blog** : mini-articles post-session (avis collectif, anecdotes, behind the scenes). Editeur simple cote admin, visible sur le portail. Commentaires des participants
- [ ] **Galerie photos** : upload de photos de la soiree par les participants, affichables sur le wallmount en mode diaporama, visibles sur le portail dans le detail de la session
- [ ] **Stats avancees / Wrapped** : page de statistiques detaillees par utilisateur
  - Genres preferes (camembert)
  - Films vus par mois (graphique)
  - Note moyenne donnee
  - Temps total passe en salle
  - Realisateurs/acteurs les plus vus
  - "Theatarr Wrapped" annuel (style Spotify Wrapped)
- [ ] **Bande-annonce discovery** : mode "zapping" de bandes-annonces en groupe. Chaque spectateur a un bouton "je veux voir" / "pas interesse" sur son telephone. Le wallmount affiche la bande-annonce en cours et les reactions en temps reel
- [ ] **Collections** : regrouper des sessions en collections (trilogie, saga, retrospective). Progression visible sur le portail
- [ ] **Behind the scenes** : fiche enrichie post-session avec anecdotes de tournage, box-office, recompenses (via TMDB/Wikipedia)

## Social & Communication

- [ ] **Fil d'actualite** : feed d'activite sur le portail (X a accepte l'invitation, nouveau film suggere, badge debloque, resultats du quiz...)
- [ ] **Discussion par session** : mini-chat/commentaires par session pour discuter avant/apres. Spoiler tag pour les discussions post-film
- [ ] **Partage social** : generer une carte visuelle "J'ai vu [Film] au Theatarr" partageable sur les reseaux (Instagram story format)
- [ ] **Invitations externes** : inviter des personnes non-inscrites via lien/QR code, avec creation de compte simplifiee

## Technique & Integrations

- [ ] **Smart home avance** : integration Home Assistant / Philips Hue / WLED pour synchroniser lumieres, rideaux, projecteur avec les sequences de session
- [ ] **Multi-room** : synchroniser une session sur plusieurs ecrans/pieces (diffusion simultanee)
- [ ] **Telecommande mobile** : controle lecture/pause/volume depuis le portail mobile pendant une session active
- [ ] **PWA notifications push** : notifications push natives sur mobile pour invitations, rappels, resultats de vote (via service worker)
- [ ] **API publique** : endpoints documentes pour integrations tierces (domotique, bots Discord/Telegram, scripts personnalises)
- [ ] **Mode hors-ligne** : cache des donnees portail pour consultation sans connexion (sessions passees, badges, stats)
