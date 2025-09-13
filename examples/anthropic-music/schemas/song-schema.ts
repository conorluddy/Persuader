import { z } from 'zod';

/**
 * Schema for comprehensive song composition
 *
 * Defines structure for complete songs including lyrics, chord progressions,
 * arrangement details, and production notes.
 */

export const ChordProgressionSchema = z
  .object({
    section: z
      .enum(['verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus'])
      .describe('Song section this progression belongs to'),
    chords: z
      .array(z.string())
      .min(2)
      .max(8)
      .describe('Chord sequence (e.g., ["C", "Am", "F", "G"])'),
    pattern: z.string().describe('Strumming or playing pattern description'),
    tempo: z
      .string()
      .describe('Tempo marking (e.g., "Moderate 4/4", "Fast waltz")'),
  })
  .describe('Chord progression for a song section');

export const LyricSectionSchema = z
  .object({
    section: z
      .enum(['verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus'])
      .describe('Type of lyric section'),
    sectionNumber: z
      .number()
      .min(1)
      .optional()
      .describe('Section number (e.g., verse 1, verse 2)'),
    lines: z
      .array(z.string())
      .min(1)
      .max(12)
      .describe('Lines of lyrics for this section'),
    rhymeScheme: z
      .string()
      .optional()
      .describe('Rhyme scheme pattern (e.g., "ABAB", "AABB")'),
  })
  .describe('Lyrics for a specific song section');

export const InstrumentationSchema = z
  .object({
    lead: z
      .array(z.string())
      .describe(
        'Lead instruments (e.g., "acoustic guitar", "piano", "violin")'
      ),
    rhythm: z
      .array(z.string())
      .describe(
        'Rhythm section (e.g., "bass guitar", "drums", "rhythm guitar")'
      ),
    harmony: z
      .array(z.string())
      .optional()
      .describe(
        'Harmony instruments (e.g., "strings", "backing vocals", "harmonica")'
      ),
    special: z
      .array(z.string())
      .optional()
      .describe('Special or featured instruments'),
  })
  .describe('Instrumental arrangement for the song');

export const SongMetadataSchema = z
  .object({
    title: z.string().min(1).max(100).describe('Song title'),
    genre: z
      .string()
      .describe(
        'Primary musical genre (e.g., "Folk Rock", "Jazz Ballad", "Country Pop")'
      ),
    mood: z
      .string()
      .describe(
        'Overall emotional mood (e.g., "Uplifting", "Melancholic", "Energetic")'
      ),
    key: z
      .string()
      .describe('Musical key (e.g., "C Major", "A Minor", "F# Major")'),
    timeSignature: z
      .string()
      .default('4/4')
      .describe('Time signature (e.g., "4/4", "3/4", "6/8")'),
    estimatedDuration: z
      .string()
      .describe('Estimated song duration (e.g., "3:30", "4:15")'),
    difficulty: z
      .enum(['beginner', 'intermediate', 'advanced'])
      .describe('Playing difficulty level'),
  })
  .describe('Song metadata and basic information');

export const SongStructureSchema = z
  .object({
    sections: z
      .array(z.string())
      .min(3)
      .max(12)
      .describe(
        'Song structure sequence (e.g., ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"])'
      ),
    totalBars: z
      .number()
      .min(16)
      .max(200)
      .optional()
      .describe('Approximate total number of bars/measures'),
    form: z
      .string()
      .optional()
      .describe('Song form description (e.g., "ABABCB", "32-bar AABA")'),
  })
  .describe('Overall song structure and arrangement');

export const ProductionNotesSchema = z
  .object({
    arrangement: z
      .string()
      .min(50)
      .max(300)
      .describe('Detailed arrangement and production suggestions'),
    dynamics: z
      .string()
      .describe(
        'Dynamic markings and volume changes (e.g., "Start soft, build to forte in chorus")'
      ),
    style: z
      .string()
      .describe(
        'Playing style notes (e.g., "Fingerpicked verses, strummed chorus")'
      ),
    tips: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe('Performance and recording tips'),
  })
  .describe('Production and performance guidance');

export const SongCompositionSchema = z
  .object({
    metadata: SongMetadataSchema,
    structure: SongStructureSchema,
    lyrics: z
      .array(LyricSectionSchema)
      .min(2)
      .describe('All lyrical sections of the song'),
    chordProgressions: z
      .array(ChordProgressionSchema)
      .min(2)
      .describe('Chord progressions for each section'),
    instrumentation: InstrumentationSchema,
    productionNotes: ProductionNotesSchema,
    inspiration: z
      .string()
      .min(100)
      .max(400)
      .describe('Artistic inspiration and thematic description'),
    listeningSuggestions: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe('Similar songs or artists for reference'),
  })
  .describe('Complete song composition with all musical and lyrical elements');

export type SongComposition = z.infer<typeof SongCompositionSchema>;
export type ChordProgression = z.infer<typeof ChordProgressionSchema>;
export type LyricSection = z.infer<typeof LyricSectionSchema>;
export type SongMetadata = z.infer<typeof SongMetadataSchema>;

/**
 * Schema for song composition input themes
 */
export const SongThemeInputSchema = z
  .object({
    theme: z
      .string()
      .min(10)
      .max(200)
      .describe('Core theme or concept for the song'),
    mood: z.string().optional().describe('Desired emotional mood'),
    genre: z.string().optional().describe('Preferred musical genre'),
    inspiration: z
      .string()
      .optional()
      .describe('Additional inspiration or context'),
    keyElements: z
      .array(z.string())
      .optional()
      .describe('Specific elements to include (instruments, themes, etc.)'),
  })
  .describe('Input theme and requirements for song composition');

export type SongThemeInput = z.infer<typeof SongThemeInputSchema>;

/**
 * Batch composition schema for multiple songs
 */
export const BatchCompositionSchema = z
  .object({
    totalSongs: z.number().min(1).describe('Total number of songs composed'),
    compositionDate: z.string().describe('Date of composition'),
    albumConcept: z
      .string()
      .optional()
      .describe('Overall album or collection concept'),
    songs: z
      .array(
        z.object({
          themeInput: SongThemeInputSchema,
          composition: SongCompositionSchema,
        })
      )
      .describe('Individual song compositions'),
    collectionNotes: z
      .string()
      .optional()
      .describe('Notes about the collection as a whole'),
  })
  .describe('Batch composition results for multiple songs');

export type BatchComposition = z.infer<typeof BatchCompositionSchema>;
