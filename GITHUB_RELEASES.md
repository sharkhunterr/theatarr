# GitHub Releases - Theatarr

> Release notes for GitHub releases

---

# v0.1.0

## Theatarr v0.1.0

The first release of **Theatarr**, a home cinema orchestration system that connects your smart home devices to create the ultimate movie experience.

### What's New

**Session Orchestration**
- Multi-sequence workflows with parallel action execution
- Real-time session control with live timeline
- Mystery mode and vote-linked sessions

**Smart Home Integration**
- **Lighting**: Philips Hue, WLED, Home Assistant, Zigbee2MQTT, ESPHome
- **Media**: Plex, Jellyfin, Chromecast, Apple TV, Android TV
- **Metadata**: TMDB, Fanart.tv enrichment

**Interactive Features**
- Token-based movie voting with QR codes
- AI-powered quiz generation
- Wallmount display with 37+ templates

**Media Management**
- Automatic trailer discovery and download
- Pre-roll and sound library
- Movie enrichment with posters, backdrops, and logos

**User Portal**
- Mobile-first participant interface
- Vote and quiz participation
- Session tracking and notifications

**Internationalization**
- 5 languages: French, English, Italian, Spanish, German
- Integrated help system with 31 articles

### Docker Quick Start

```yaml
services:
  theatarr:
    image: sharkhunterr/theatarr:latest
    ports:
      - "8080:8080"
    volumes:
      - theatarr-data:/data
    environment:
      - SECRET_KEY=your-secret-key-at-least-32-characters-long
      - TZ=Europe/Paris

volumes:
  theatarr-data:
```

### Links

- [Docker Hub](https://hub.docker.com/r/sharkhunterr/theatarr)
- [Documentation](https://github.com/sharkhunterr/theatarr#readme)
- [Report Issues](https://github.com/sharkhunterr/theatarr/issues)

---

# Instructions

1. Go to https://github.com/sharkhunterr/theatarr/releases/new
2. **Tag**: Use the version tag
3. **Target**: `main`
4. **Title**: Copy the title from the version section
5. **Description**: Copy everything from `## Theatarr` to the end of the section
6. **Publish release**

> The script `npm run release:full` automatically takes the FIRST version section (the one at the top)
