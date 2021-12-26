import { YouTubeVideo } from '../classes/Video';
import { YouTubePlayList } from '../classes/Playlist';
import { YouTubeChannel } from '../classes/Channel';
import { YouTube } from '..';

export interface ParseSearchInterface {
    type?: 'video' | 'playlist' | 'channel';
    limit?: number;
    language?: string;
}

export interface thumbnail {
    width: string;
    height: string;
    url: string;
}
/**
 * Main command which converts html body data and returns the type of data requested.
 * @param html body of that request
 * @param options limit & type of YouTube search you want.
 * @returns Array of one of YouTube type.
 */
export function ParseSearchResult(html: string, options?: ParseSearchInterface): YouTube[] {
    if (!html) throw new Error("Can't parse Search result without data");
    if (!options) options = { type: 'video', limit: 0 };
    else if (!options.type) options.type = 'video';
    const hasLimit = typeof options.limit === 'number' && options.limit > 0;

    const data = html
        .split('var ytInitialData = ')?.[1]
        ?.split(';</script>')[0]
        .split(/;\s*(var|const|let)\s/)[0];
    const json_data = JSON.parse(data);
    const results = [];
    const details =
        json_data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0]
            .itemSectionRenderer.contents;
    for (const detail of details) {
        if (hasLimit && results.length === options.limit) break;
        if (!detail.videoRenderer && !detail.channelRenderer && !detail.playlistRenderer) continue;
        switch (options.type) {
            case 'video': {
                const parsed = parseVideo(detail);
                if (parsed) results.push(parsed);
                break;
            }
            case 'channel': {
                const parsed = parseChannel(detail);
                if (parsed) results.push(parsed);
                break;
            }
            case 'playlist': {
                const parsed = parsePlaylist(detail);
                if (parsed) results.push(parsed);
                break;
            }
            default:
                throw new Error(`Unknown search type: ${options.type}`);
        }
    }
    return results;
}
/**
 * Function to convert [hour : minutes : seconds] format to seconds
 * @param duration hour : minutes : seconds format
 * @returns seconds
 */
function parseDuration(duration: string): number {
    if (!duration) return 0;
    const args = duration.split(':');
    let dur = 0;

    switch (args.length) {
        case 3:
            dur = parseInt(args[0]) * 60 * 60 + parseInt(args[1]) * 60 + parseInt(args[2]);
            break;
        case 2:
            dur = parseInt(args[0]) * 60 + parseInt(args[1]);
            break;
        default:
            dur = parseInt(args[0]);
    }

    return dur;
}
/**
 * Function to parse Channel searches
 * @param data body of that channel request.
 * @returns YouTubeChannel class
 */
export function parseChannel(data?: any): YouTubeChannel {
    if (!data || !data.channelRenderer) throw new Error('Failed to Parse YouTube Channel');
    const badge = data.channelRenderer.ownerBadges?.[0]?.metadataBadgeRenderer?.style?.toLowerCase();
    const url = `https://www.youtube.com${
        data.channelRenderer.navigationEndpoint.browseEndpoint.canonicalBaseUrl ||
        data.channelRenderer.navigationEndpoint.commandMetadata.webCommandMetadata.url
    }`;
    const thumbnail = data.channelRenderer.thumbnail.thumbnails[data.channelRenderer.thumbnail.thumbnails.length - 1];
    const res = new YouTubeChannel({
        id: data.channelRenderer.channelId,
        name: data.channelRenderer.title.simpleText,
        icon: {
            url: thumbnail.url.replace('//', 'https://'),
            width: thumbnail.width,
            height: thumbnail.height
        },
        url: url,
        verified: Boolean(badge?.includes('verified')),
        artist: Boolean(badge?.includes('artist')),
        subscribers: data.channelRenderer.subscriberCountText?.simpleText ?? '0 subscribers'
    });

    return res;
}
/**
 * Function to parse Video searches
 * @param data body of that video request.
 * @returns YouTubeVideo class
 */
export function parseVideo(data?: any): YouTubeVideo {
    if (!data || !data.videoRenderer) throw new Error('Failed to Parse YouTube Video');

    const channel = data.videoRenderer.ownerText.runs[0];
    const badge = data.videoRenderer.ownerBadges?.[0]?.metadataBadgeRenderer?.style?.toLowerCase();
    const durationText = data.videoRenderer.lengthText;
    const res = new YouTubeVideo({
        id: data.videoRenderer.videoId,
        url: `https://www.youtube.com/watch?v=${data.videoRenderer.videoId}`,
        title: data.videoRenderer.title.runs[0].text,
        description: data.videoRenderer.detailedMetadataSnippets?.[0].snippetText.runs.length
            ? data.videoRenderer.detailedMetadataSnippets[0].snippetText.runs.map((run: any) => run.text).join('')
            : '',
        duration: durationText ? parseDuration(durationText.simpleText) : 0,
        duration_raw: durationText ? durationText.simpleText : null,
        thumbnails: data.videoRenderer.thumbnail.thumbnails,
        channel: {
            id: channel.navigationEndpoint.browseEndpoint.browseId || null,
            name: channel.text || null,
            url: `https://www.youtube.com${
                channel.navigationEndpoint.browseEndpoint.canonicalBaseUrl ||
                channel.navigationEndpoint.commandMetadata.webCommandMetadata.url
            }`,
            icons: data.videoRenderer.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail
                .thumbnails,
            verified: Boolean(badge?.includes('verified')),
            artist: Boolean(badge?.includes('artist'))
        },
        uploadedAt: data.videoRenderer.publishedTimeText?.simpleText ?? null,
        views: data.videoRenderer.viewCountText?.simpleText?.replace(/[^0-9]/g, '') ?? 0,
        live: durationText ? false : true
    });

    return res;
}
/**
 * Function to parse Playlist searches
 * @param data body of that playlist request.
 * @returns YouTubePlaylist class
 */
export function parsePlaylist(data?: any): YouTubePlayList {
    if (!data || !data.playlistRenderer) throw new Error('Failed to Parse YouTube Playlist');

    const thumbnail =
        data.playlistRenderer.thumbnails[0].thumbnails[data.playlistRenderer.thumbnails[0].thumbnails.length - 1];
    const channel = data.playlistRenderer.shortBylineText.runs?.[0];

    const res = new YouTubePlayList(
        {
            id: data.playlistRenderer.playlistId,
            title: data.playlistRenderer.title.simpleText,
            thumbnail: {
                id: data.playlistRenderer.playlistId,
                url: thumbnail.url,
                height: thumbnail.height,
                width: thumbnail.width
            },
            channel: {
                id: channel?.navigationEndpoint.browseEndpoint.browseId,
                name: channel?.text,
                url: `https://www.youtube.com${channel?.navigationEndpoint.commandMetadata.webCommandMetadata.url}`
            },
            videos: parseInt(data.playlistRenderer.videoCount.replace(/[^0-9]/g, ''))
        },
        true
    );

    return res;
}
