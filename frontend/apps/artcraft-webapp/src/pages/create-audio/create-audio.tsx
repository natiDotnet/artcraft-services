import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterMediaClasses } from "@storyteller/api";
import type { OmniGenAudioModelDetails } from "@storyteller/api";
import { PopoverMenu, type PopoverItem } from "@storyteller/ui-popover";
import { Tooltip } from "@storyteller/ui-tooltip";
import { Button, ToggleButton } from "@storyteller/ui-button";
import { SliderV2 } from "@storyteller/ui-sliderv2";
import { GalleryModal, type GalleryItem as PickerGalleryItem } from "@storyteller/ui-gallery-modal";
import {
  AudioTuningPopover,
  SoundsSettingsPopover,
  StylePromptRow,
  MUSICAL_KEYS,
  formatSampleRateHz,
  AUDIO_BPM_MIN,
  AUDIO_BPM_MAX,
  AUDIO_SPEED_MIN,
  AUDIO_SPEED_MAX,
  AUDIO_VOLUME_MIN,
  AUDIO_VOLUME_MAX,
  AUDIO_PITCH_MIN,
  AUDIO_PITCH_MAX,
} from "@storyteller/ui-promptbox";
import {
  PromptBox,
  ImagePromptRow,
  MediaReferenceRow,
  MobilePromptForm,
  MobileSelectField,
  MobileFieldButton,
  SettingsDrawer,
  DrawerOptionList,
  DrawerSection,
  getAudioDurationFromUrl,
  type RefAudio,
  type RefImage,
} from "../../components/prompt-box";
import {
  GenerationGallery,
  useGalleryData,
  useGenerationJobs,
  useAuthCheck,
  usePromptHeight,
  useLightboxNav,
  CreateMediaPageShell,
  type GalleryItem,
} from "../../components/generation-gallery";
import { Lightbox } from "../../components/lightbox/lightbox";
import { useCreateAudioStore } from "./create-audio-store";
import {
  enqueueAudioGeneration,
  AUDIO_MODELS_REQUIRING_AUDIO_REF,
} from "./generate-audio-api";
import type { AudioGenerationSettings } from "./generate-audio-api";
import { useAudioCostEstimate } from "../../lib/cost-estimate-api";
import { resolveModelNumberOption } from "../../lib/resolve-model-setting";
import {
  useOmniGenAudioModels,
  OMNI_GENERATE_OUTAGE_MESSAGE,
} from "@storyteller/omni-gen";
import {
  getCreatorIconPathForModelId,
  getModelDescription,
  getModelInfo,
} from "@storyteller/model-list";
import { toast } from "../../components/toast/toast";
import { useSignupCta } from "../../components/signup-cta-modal";
import { useInsufficientCredits } from "../../components/insufficient-credits-modal";
import { MediaUploadApi } from "@storyteller/api";
import { MicIcon, MicOffIcon, PauseIcon, PlayIcon, RepeatIcon, SparklesIcon, Volume2Icon } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────

export const FISH_AUDIO_TTS_MODEL_ID = "fish-audio/s2.1-pro-free:free";

export interface FishAudioVoice {
  id: string;
  name: string;
  gender: "female" | "male";
  description: string;
  tags: string[];
  sampleAudio: string;
}

export const FISH_AUDIO_VOICES: FishAudioVoice[] = [
  {
    id: "9a9cf47702da476aa4629e2506d4a857",
    name: "Hannah",
    gender: "female",
    description: "A conversation specialist.",
    tags: ["Female", "Conversational", "Friendly"],
    sampleAudio: "https://platform.r2.fish.audio/task/08d658835feb427db808e37060b78eb0.mp3",
  },
  {
    id: "bf322df2096a46f18c579d0baa36f41d",
    name: "Adrian",
    gender: "male",
    description: "A steady and reliable narrator.",
    tags: ["Male", "Narration", "Storytelling"],
    sampleAudio: "https://platform.r2.fish.audio/task/d730b09f4a484316a77ecc86137e85fb.mp3",
  },
  {
    id: "933563129e564b19a115bedd57b7406a",
    name: "Sarah",
    gender: "female",
    description: "An engaged speaker.",
    tags: ["Female", "Soft", "Sincere"],
    sampleAudio: "https://platform.r2.fish.audio/task/4e204945670c460c86fdab57512cb308.mp3",
  },
  {
    id: "536d3a5e000945adb7038665781a4aca",
    name: "Ethan",
    gender: "male",
    description: "A curious explainer.",
    tags: ["Male", "Educational", "Clear"],
    sampleAudio: "https://platform.r2.fish.audio/task/bdd677ed767744fc91f166468786264b.mp3",
  },
  {
    id: "e3cd384158934cc9a01029cd7d278634",
    name: "Laura",
    gender: "female",
    description: "A confident female narrator.",
    tags: ["Female", "Warm", "Professional"],
    sampleAudio: "https://platform.r2.fish.audio/task/e821bef995344d519caa1c93d808db23.mp3",
  },
  {
    id: "79d0bd3e4e5444b18f7b6d89b5927bf1",
    name: "Jordan",
    gender: "male",
    description: "A motivational speaker.",
    tags: ["Male", "Motivational", "Measured"],
    sampleAudio: "https://platform.r2.fish.audio/task/edecbc0bdd4c46c39eda8520a0f729ef.mp3",
  },
  {
    id: "b347db033a6549378b48d00acb0d06cd",
    name: "Selene",
    gender: "female",
    description: "A meditative female voice.",
    tags: ["Female", "Calm", "ASMR"],
    sampleAudio: "https://platform.r2.fish.audio/task/fcf629b4a0b343558f461338ba1b9da4.mp3",
  },
];

function buildVoicePopoverItems(
  selectedVoiceId: string,
  playingVoiceId: string | null,
  onTogglePreview: (e: React.MouseEvent, voice: FishAudioVoice) => void,
): PopoverItem[] {
  return FISH_AUDIO_VOICES.map((v) => {
    const isPlaying = playingVoiceId === v.id;
    return {
      label: v.name,
      selected: v.id === selectedVoiceId,
      description: v.description,
      badges: [
        { label: v.gender === "female" ? "Female" : "Male" },
        ...v.tags.slice(1).map((tag) => ({ label: tag })),
      ],
      action: v.id,
      icon: <Volume2Icon className="h-4 w-4 text-emerald-400" />,
      trailing: (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview(e, v);
          }}
          className="flex items-center justify-center h-7 w-7 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
          title={isPlaying ? "Pause sample" : "Play sample audio"}
        >
          {isPlaying ? (
            <PauseIcon className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <PlayIcon className="h-3.5 w-3.5" />
          )}
        </button>
      ),
    };
  });
}

const FISH_AUDIO_MODEL_DETAILS: OmniGenAudioModelDetails = {
  model: FISH_AUDIO_TTS_MODEL_ID,
  model_creator: "fish_audio",
  full_name: "Fish Audio S2.1 Pro (Free)",
  extra_info_short: "Ultra-fast text-to-speech voice generation (100% Free)",
  text_prompt_supported: true,
  speed_supported: true,
};

const DEFAULT_MODEL_ID = "suno_music";

const AUDIO_FILTER = [FilterMediaClasses.AUDIO];

const AUDIO_REF_MAX_DURATION_SECONDS = 600;

const supports = (flag: boolean | null | undefined): boolean => flag === true;

// The lib ToggleButton still carries the old glassy look (2px transparent
// border, grey translucent blur). These overrides align the audio toggles
// with their sibling toolbar controls (the PopoverMenu triggers): flat
// ui-controls surface, 1px hairline border, 4px corners. Active keeps the
// brand tint as the on-state affordance.
const toolbarToggleClassName = (isActive: boolean): string =>
  isActive
    ? "rounded-[3px] border border-ui-controls-border backdrop-blur-none hover:border-ui-controls-border"
    : "rounded-[3px] border border-ui-controls-border bg-ui-controls backdrop-blur-none hover:bg-ui-controls/80";

// Store API model data alongside popover items via a lookup map
let _modelLookup = new Map<string, OmniGenAudioModelDetails>();

function buildModelPopoverItems(
  models: OmniGenAudioModelDetails[],
  selectedId: string,
): PopoverItem[] {
  _modelLookup = new Map(models.map((m) => [m.model, m]));
  return models.map((model) => {
    const isFishAudio = model.model === FISH_AUDIO_TTS_MODEL_ID;
    return {
      label: model.full_name || model.model,
      selected: model.model === selectedId,
      description: isFishAudio
        ? "Ultra-fast text-to-speech voice generation (100% Free)"
        : getModelDescription(model.model, model.extra_info_short),
      info: getModelInfo(model.model, model.extra_info) || undefined,
      badges: isFishAudio ? [{ label: "Free" }] : undefined,
      icon: isFishAudio ? (
        <Volume2Icon className="h-4 w-4 text-emerald-400" />
      ) : (
        <img
          src={getCreatorIconPathForModelId(model.model)}
          alt={`${model.model} logo`}
          className="h-4 w-4 icon-auto-contrast"
        />
      ),
      action: model.model, // use action to carry the model id
    };
  });
}

// ── Component ────────────────────────────────────────────────────────────

export default function CreateAudio() {
  const { user, authChecked } = useAuthCheck();
  const { loggedIn, openSignupCta } = useSignupCta();
  const openInsufficientCredits = useInsufficientCredits();
  const { promptBoxRef, promptHeight } = usePromptHeight();

  // Fetch models from API
  const { models: apiModels } = useOmniGenAudioModels();

  const allModels = useMemo((): OmniGenAudioModelDetails[] => {
    return [...apiModels, FISH_AUDIO_MODEL_DETAILS];
  }, [apiModels]);

  // UI state
  const ui = useCreateAudioStore((s) => s.ui);
  const setUi = useCreateAudioStore((s) => s.setUi);

  const selectedModel = useMemo((): OmniGenAudioModelDetails | undefined => {
    if (!allModels.length) return undefined;
    if (ui.selectedModelId) {
      return (
        allModels.find((m) => m.model === ui.selectedModelId) ??
        allModels.find((m) => m.model === DEFAULT_MODEL_ID) ??
        allModels[0]
      );
    }
    return allModels.find((m) => m.model === DEFAULT_MODEL_ID) ?? allModels[0];
  }, [allModels, ui.selectedModelId]);

  const prompt = ui.prompt;
  const setPrompt = useCallback((v: string) => setUi({ prompt: v }), [setUi]);
  const setStylePrompt = useCallback(
    (v: string) => setUi({ stylePrompt: v }),
    [setUi],
  );

  // Capability gating. Flags are serde-skipped when absent — only `true`
  // counts as supported.
  const styleSupported = supports(selectedModel?.style_prompt_supported);
  const hasInstrumental = supports(
    selectedModel?.instrumental_toggle_supported,
  );
  const hasKeepLyrics = supports(selectedModel?.keep_lyrics_supported);
  const hasLoopable = supports(selectedModel?.loopable_toggle_supported);
  const hasBpm = supports(selectedModel?.bpm_supported);
  const hasMusicalKey = supports(selectedModel?.musical_key_supported);
  const sampleRateOptions = selectedModel?.sample_rate_hz_options ?? null;
  const hasSpeed = supports(selectedModel?.speed_supported);
  const hasVolume = supports(selectedModel?.volume_supported);
  const hasPitch = supports(selectedModel?.pitch_supported);
  const hasTuning =
    !!sampleRateOptions?.length || hasSpeed || hasVolume || hasPitch;
  const audioRefsSupported = supports(
    selectedModel?.audio_references_supported,
  );
  const maxAudioRefs = selectedModel?.audio_references_max ?? 1;
  const imageRefsSupported = supports(
    selectedModel?.image_references_supported,
  );
  const maxImageRefs = selectedModel?.image_references_max ?? 1;
  const requiresAudioRef = AUDIO_MODELS_REQUIRING_AUDIO_REF.has(
    selectedModel?.model ?? "",
  );

  // Seed Audio output shaping — sticky across model switches; numeric sliders
  // clamp at read time so persisted values always stay in the valid range.
  const sampleRateHz =
    resolveModelNumberOption(
      ui.sampleRateHz,
      sampleRateOptions,
      selectedModel?.sample_rate_hz_default,
    ) ?? null;
  const speed = clamp(ui.speed, AUDIO_SPEED_MIN, AUDIO_SPEED_MAX);
  const volume = clamp(ui.volume, AUDIO_VOLUME_MIN, AUDIO_VOLUME_MAX);
  const pitch = clamp(ui.pitch, AUDIO_PITCH_MIN, AUDIO_PITCH_MAX);

  const [isGenerating, setIsGenerating] = useState(false);
  const referenceAudios = useCreateAudioStore((s) => s.referenceAudios);
  const setReferenceAudios = useCreateAudioStore((s) => s.setReferenceAudios);
  const referenceImages = useCreateAudioStore((s) => s.referenceImages);
  const setReferenceImages = useCreateAudioStore((s) => s.setReferenceImages);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [audioPickerSelectedIds, setAudioPickerSelectedIds] = useState<
    string[]
  >([]);
  const [isBeatDrawerOpen, setIsBeatDrawerOpen] = useState(false);
  const [isTuningDrawerOpen, setIsTuningDrawerOpen] = useState(false);

  useEffect(() => {
    if (isImagePickerOpen) setPickerSelectedIds([]);
  }, [isImagePickerOpen]);

  useEffect(() => {
    if (isAudioPickerOpen) setAudioPickerSelectedIds([]);
  }, [isAudioPickerOpen]);

  const handlePickerSelect = useCallback(
    (id: string) => {
      setPickerSelectedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= maxImageRefs) {
          return maxImageRefs === 1 ? [id] : prev;
        }
        return [...prev, id];
      });
    },
    [maxImageRefs],
  );

  const isFishAudio = selectedModel?.model === FISH_AUDIO_TTS_MODEL_ID;
  const [localCompletedItems, setLocalCompletedItems] = useState<GalleryItem[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggleVoiceSample = useCallback(
    (e: React.MouseEvent, voice: FishAudioVoice) => {
      e.stopPropagation();
      if (playingVoiceId === voice.id) {
        sampleAudioRef.current?.pause();
        setPlayingVoiceId(null);
      } else {
        if (sampleAudioRef.current) {
          sampleAudioRef.current.pause();
        }
        const audio = new Audio(voice.sampleAudio);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        audio.play().catch(() => setPlayingVoiceId(null));
        sampleAudioRef.current = audio;
        setPlayingVoiceId(voice.id);
      }
    },
    [playingVoiceId],
  );

  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current = null;
      }
    };
  }, []);

  const voiceItems = useMemo(
    () =>
      buildVoicePopoverItems(
        ui.selectedVoiceId,
        playingVoiceId,
        handleToggleVoiceSample,
      ),
    [ui.selectedVoiceId, playingVoiceId, handleToggleVoiceSample],
  );

  const selectedVoice = useMemo(
    () =>
      FISH_AUDIO_VOICES.find((v) => v.id === ui.selectedVoiceId) ??
      FISH_AUDIO_VOICES[0],
    [ui.selectedVoiceId],
  );

  // Jobs + gallery
  const jobs = useGenerationJobs({ mediaType: "audio", enabled: !!user });
  const gallery = useGalleryData({
    username: user?.username ?? null,
    filterMediaClasses: AUDIO_FILTER,
    excludeUploads: true,
  });

  const newlyCompletedTokens = useMemo(
    () => new Set([
      ...jobs.newlyCompleted.map((i) => i.id),
      ...localCompletedItems.map((i) => i.id),
    ]),
    [jobs.newlyCompleted, localCompletedItems],
  );

  // Lightbox
  const flatItems = useMemo(() => {
    const filtered = gallery.items.filter(
      (i) => !newlyCompletedTokens.has(i.id),
    );
    return [...localCompletedItems, ...jobs.newlyCompleted, ...filtered];
  }, [localCompletedItems, jobs.newlyCompleted, gallery.items, newlyCompletedTokens]);

  const lightbox = useLightboxNav(flatItems);

  const estimatedCredits = useAudioCostEstimate({
    model: selectedModel?.model ?? "",
    audioReferenceCount: referenceAudios.length,
    hasImageReference: referenceImages.length > 0,
    sampleRateHz: sampleRateOptions?.length ? sampleRateHz : undefined,
  });

  const displayCredits = isFishAudio ? 0 : estimatedCredits;

  const modelItems = useMemo(
    () => buildModelPopoverItems(allModels, selectedModel?.model ?? ""),
    [allModels, selectedModel?.model],
  );

  const hasContent =
    localCompletedItems.length > 0 ||
    jobs.inProgress.length > 0 ||
    jobs.failed.length > 0 ||
    jobs.newlyCompleted.length > 0 ||
    gallery.items.length > 0 ||
    gallery.isInitialLoading;

  const missingRequiredAudioRef =
    requiresAudioRef && referenceAudios.length !== 1;
  const canGenerate =
    !!prompt.trim() && !isGenerating && !missingRequiredAudioRef;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleModelChange = useCallback(
    (item: PopoverItem) => {
      const model = item.action ? _modelLookup.get(item.action) : undefined;
      if (!model) return;
      // Only switch the model — style/toggles/tuning are preserved and
      // resolved against the new model at read time, so the user's choices
      // survive model switches instead of resetting to defaults.
      setUi({ selectedModelId: model.model });
    },
    [setUi],
  );

  // Seed Audio can't combine audio and image references — adding one kind
  // clears the other so the request is always valid.
  const handleReferenceAudiosChange = useCallback(
    (audios: typeof referenceAudios) => {
      if (audios.length > 0 && referenceImages.length > 0) {
        setReferenceImages([]);
        toast.error(
          "Removed image reference — it can't be combined with audio",
        );
      }
      setReferenceAudios(audios);
    },
    [referenceImages, setReferenceAudios, setReferenceImages],
  );

  const handleReferenceImagesChange = useCallback(
    (images: RefImage[]) => {
      if (images.length > 0 && referenceAudios.length > 0) {
        setReferenceAudios([]);
        toast.error(
          "Removed audio reference — it can't be combined with an image",
        );
      }
      setReferenceImages(images);
    },
    [referenceAudios, setReferenceAudios, setReferenceImages],
  );

  const audioPickerMax = Math.max(1, maxAudioRefs - referenceAudios.length);

  const handleAudioPickerSelect = useCallback(
    (id: string) => {
      setAudioPickerSelectedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= audioPickerMax) {
          return audioPickerMax === 1 ? [id] : prev;
        }
        return [...prev, id];
      });
    },
    [audioPickerMax],
  );

  const handleLibraryAudioSelect = useCallback(
    async (items: PickerGalleryItem[]) => {
      setIsAudioPickerOpen(false);
      const availableSlots = Math.max(0, maxAudioRefs - referenceAudios.length);
      const picked = items.slice(0, availableSlots);

      const added: RefAudio[] = [];
      let total = referenceAudios.reduce((sum, a) => sum + a.duration, 0);
      for (const item of picked) {
        const url = item.fullImage;
        if (!url) continue;
        const duration =
          item.durationMillis != null
            ? Math.round(item.durationMillis / 1000)
            : await getAudioDurationFromUrl(url);
        if (duration <= 0) {
          toast.error("Could not read audio file");
          continue;
        }
        if (total + duration > AUDIO_REF_MAX_DURATION_SECONDS) {
          toast.error(
            `Total audio duration cannot exceed ${AUDIO_REF_MAX_DURATION_SECONDS}s`,
          );
          continue;
        }
        total += duration;
        added.push({
          id: Math.random().toString(36).substring(7),
          url,
          file: new File([], "library-audio"),
          mediaToken: item.id,
          duration,
        });
      }
      if (added.length > 0) {
        handleReferenceAudiosChange([...referenceAudios, ...added]);
      }
    },
    [referenceAudios, maxAudioRefs, handleReferenceAudiosChange],
  );

  const handleLibraryImageSelect = useCallback(
    (items: PickerGalleryItem[]) => {
      const newImages: RefImage[] = items
        .slice(0, maxImageRefs)
        .map((item) => ({
          id: Math.random().toString(36).substring(7),
          url: item.thumbnail || item.fullImage || "",
          fullUrl: item.fullImage || undefined,
          file: new File([], "library-image"),
          mediaToken: item.id,
        }));
      handleReferenceImagesChange(newImages);
      setIsImagePickerOpen(false);
    },
    [maxImageRefs, handleReferenceImagesChange],
  );

  // Refs already in each slot, greyed out in that slot's picker so the same
  // media file can't be added twice to one field.
  const usedImageTokens = useMemo(
    () =>
      referenceImages
        .map((img) => img.mediaToken)
        .filter((t): t is string => !!t),
    [referenceImages],
  );

  const usedAudioTokens = useMemo(
    () =>
      referenceAudios
        .map((audio) => audio.mediaToken)
        .filter((t): t is string => !!t),
    [referenceAudios],
  );

  const handleGenerate = useCallback(async () => {
    if (!loggedIn) {
      openSignupCta();
      return;
    }
    if (!prompt.trim() || isGenerating || !selectedModel) return;

    if (missingRequiredAudioRef) {
      toast.error(
        `${selectedModel.full_name ?? "This model"} needs an audio track to work from — add one first`,
      );
      return;
    }

    if (isFishAudio) {
      setIsGenerating(true);
      try {
        let response = await fetch("/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: FISH_AUDIO_TTS_MODEL_ID,
            input: prompt.trim(),
            voice: ui.selectedVoiceId || "b347db033a6549378b48d00acb0d06cd",
            response_format: "mp3",
            speed: hasSpeed ? speed : undefined,
          }),
        });

        // Transient 503 retry (e.g. if free model is waking up)
        if (!response.ok && response.status === 503) {
          await new Promise((r) => setTimeout(r, 1200));
          response = await fetch("/v1/audio/speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: FISH_AUDIO_TTS_MODEL_ID,
              input: prompt.trim(),
              voice: ui.selectedVoiceId || "b347db033a6549378b48d00acb0d06cd",
              response_format: "mp3",
              speed: hasSpeed ? speed : undefined,
            }),
          });
        }

        if (!response.ok) {
          let errMessage = "Speech generation failed";
          try {
            const errData = await response.json();
            errMessage = errData.message || errData.error_message || errMessage;
          } catch {}
          toast.error(errMessage);
          setIsGenerating(false);
          return;
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {});

        let mediaToken: string | undefined;
        try {
          const uploadRes = await new MediaUploadApi().UploadAudio({
            blob,
            fileName: `speech-${Date.now()}.mp3`,
            uuid: crypto.randomUUID(),
            maybe_title: prompt.trim().slice(0, 100),
          });
          if (uploadRes.success && uploadRes.data) {
            mediaToken = uploadRes.data;
          }
        } catch (uploadErr) {
          console.error("Audio upload error:", uploadErr);
        }

        const newItem: GalleryItem = {
          id: mediaToken || `speech-${Date.now()}`,
          label: prompt.trim().slice(0, 50),
          thumbnail: null,
          fullImage: audioUrl,
          createdAt: new Date().toISOString(),
          mediaClass: "audio",
          modelId: FISH_AUDIO_TTS_MODEL_ID,
        };

        setLocalCompletedItems((prev) => [newItem, ...prev]);
        toast.success("Speech generated successfully!");
        window.dispatchEvent(new Event("task-queue-update"));
        window.dispatchEvent(new Event("credits-change"));
      } catch (err: any) {
        toast.error(err?.message || "Failed to generate speech");
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);

    try {
      const settings: AudioGenerationSettings = {
        prompt,
        stylePrompt: ui.stylePrompt,
        audioMediaTokens: referenceAudios
          .map((a) => a.mediaToken)
          .filter((t): t is string => typeof t === "string" && t.length > 0),
        imageMediaTokens: referenceImages
          .map((img) => img.mediaToken)
          .filter((t): t is string => typeof t === "string" && t.length > 0),
        isInstrumental: ui.isInstrumental,
        keepLyrics: ui.keepLyrics,
        isLoopable: ui.isLoopable,
        bpm: ui.bpm,
        musicalKey: ui.musicalKey,
        sampleRateHz,
        speed,
        volume,
        pitch,
      };

      const result = await enqueueAudioGeneration(selectedModel, settings);

      if (!result.success) {
        // 402 Payment Required: the user is out of credits. Surface the
        // upgrade modal instead of an error toast.
        if (result.errorCode === 402) {
          openInsufficientCredits();
        } else if (result.errorCode != null && result.errorCode >= 500) {
          toast.error(OMNI_GENERATE_OUTAGE_MESSAGE);
        } else {
          toast.error(result.error ?? "Failed to start generation");
        }
        setIsGenerating(false);
        return;
      }

      // The jobs feed (5s poll + this nudge) renders the pending cards — one
      // per job token (Suno can return several clips per request).
      window.dispatchEvent(new Event("credits-change"));
      window.dispatchEvent(new Event("task-queue-update"));
    } catch {
      toast.error("Network error - please try again");
    } finally {
      setIsGenerating(false);
    }
  }, [
    loggedIn,
    openSignupCta,
    openInsufficientCredits,
    prompt,
    isGenerating,
    selectedModel,
    missingRequiredAudioRef,
    ui.stylePrompt,
    ui.isInstrumental,
    ui.keepLyrics,
    ui.isLoopable,
    ui.bpm,
    ui.musicalKey,
    sampleRateHz,
    speed,
    volume,
    pitch,
    referenceAudios,
    referenceImages,
    isFishAudio,
    hasSpeed,
    ui.selectedVoiceId,
  ]);

  // ── Toolbar pieces (shared between desktop promptbox + fullscreen) ────

  const toggleButtons = (
    <>
      {hasInstrumental && (
        <Tooltip
          content={ui.isInstrumental ? "Instrumental: ON" : "Instrumental: OFF"}
          position="top"
          className="z-50"
          delay={200}
        >
          <ToggleButton
            isActive={ui.isInstrumental}
            icon={MicOffIcon}
            activeIcon={MicOffIcon}
            label="Instrumental"
            className={toolbarToggleClassName(ui.isInstrumental)}
            onClick={() => setUi({ isInstrumental: !ui.isInstrumental })}
          />
        </Tooltip>
      )}
      {hasKeepLyrics && (
        <Tooltip
          content={ui.keepLyrics ? "Keep lyrics: ON" : "Keep lyrics: OFF"}
          position="top"
          className="z-50"
          delay={200}
        >
          <ToggleButton
            isActive={ui.keepLyrics}
            icon={MicIcon}
            activeIcon={MicIcon}
            label="Keep lyrics"
            className={toolbarToggleClassName(ui.keepLyrics)}
            onClick={() => setUi({ keepLyrics: !ui.keepLyrics })}
          />
        </Tooltip>
      )}
      {hasLoopable && (
        <Tooltip
          content={ui.isLoopable ? "Loop: ON" : "Loop: OFF"}
          position="top"
          className="z-50"
          delay={200}
        >
          <ToggleButton
            isActive={ui.isLoopable}
            icon={RepeatIcon}
            activeIcon={RepeatIcon}
            label="Loop"
            className={toolbarToggleClassName(ui.isLoopable)}
            onClick={() => setUi({ isLoopable: !ui.isLoopable })}
          />
        </Tooltip>
      )}
    </>
  );

  const leftToolbar = (
    <>
      {isFishAudio ? (
        <PopoverMenu
          items={voiceItems}
          onSelect={(item) => {
            if (item.action) setUi({ selectedVoiceId: item.action });
          }}
          mode="toggle"
          panelTitle="Voice Choices"
          panelClassName="w-[340px]"
          richList
          renderTrigger={() => (
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-[3px] border border-ui-controls-border bg-ui-controls hover:bg-ui-controls/80 text-foreground transition-colors"
            >
              <Volume2Icon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Voice: {selectedVoice.name}</span>
            </button>
          )}
        />
      ) : (
        <>
          {toggleButtons}
          {(hasBpm || hasMusicalKey) && (
            <SoundsSettingsPopover
              showBpm={hasBpm}
              bpm={ui.bpm}
              onBpmChange={(bpm) => setUi({ bpm })}
              showMusicalKey={hasMusicalKey}
              musicalKey={ui.musicalKey}
              onMusicalKeyChange={(musicalKey) => setUi({ musicalKey })}
            />
          )}
        </>
      )}
      {hasTuning && (
        <AudioTuningPopover
          sampleRateOptions={sampleRateOptions}
          sampleRateHz={sampleRateHz}
          onSampleRateChange={(hz) => setUi({ sampleRateHz: hz })}
          showSpeed={hasSpeed}
          speed={speed}
          onSpeedChange={(v) => setUi({ speed: v })}
          showVolume={hasVolume}
          volume={volume}
          onVolumeChange={(v) => setUi({ volume: v })}
          showPitch={hasPitch}
          pitch={pitch}
          onPitchChange={(v) => setUi({ pitch: v })}
        />
      )}
    </>
  );

  // Mobile-only band; on desktop the audio refs live in the reference deck.
  const audioReferenceRow = audioRefsSupported ? (
    <MediaReferenceRow
      videoSupported={false}
      audioSupported
      referenceVideos={[]}
      onReferenceVideosChange={() => {}}
      maxVideoCount={0}
      maxVideoRefDuration={0}
      referenceAudios={referenceAudios}
      onReferenceAudiosChange={handleReferenceAudiosChange}
      maxAudioCount={maxAudioRefs}
      maxAudioRefDuration={AUDIO_REF_MAX_DURATION_SECONDS}
      onPickAudioFromLibrary={() => setIsAudioPickerOpen(true)}
    />
  ) : undefined;

  // ── Mobile form ────────────────────────────────────────────────────────

  const beatSummary = [
    hasBpm ? (ui.bpm === null ? "Auto BPM" : `${ui.bpm} BPM`) : null,
    hasMusicalKey
      ? (MUSICAL_KEYS.find((k) => k.value === ui.musicalKey)?.label ?? "Auto")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tuningSummary = [
    sampleRateOptions?.length && sampleRateHz
      ? formatSampleRateHz(sampleRateHz)
      : null,
    hasSpeed ? `${speed.toFixed(2)}×` : null,
    hasPitch && pitch !== 0 ? `${pitch > 0 ? "+" : ""}${pitch} st` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const mobileForm = (
    <MobilePromptForm
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmit={handleGenerate}
      isSubmitting={isGenerating}
      credits={displayCredits}
      placeholder={
        isFishAudio
          ? "Enter text to convert to speech..."
          : "Describe the music or sound you want..."
      }
      autoAdvance={loggedIn && canGenerate}
      modelField={
        <MobileSelectField
          label="Model"
          title="Select Model"
          items={modelItems}
          onSelect={handleModelChange}
        />
      }
      frames={
        imageRefsSupported ? (
          <ImagePromptRow
            maxImagePromptCount={maxImageRefs}
            referenceImages={referenceImages}
            setReferenceImages={handleReferenceImagesChange}
            onPickFromLibrary={() => setIsImagePickerOpen(true)}
          />
        ) : undefined
      }
      mediaRefs={audioReferenceRow}
      settingsFields={
        <>
          {isFishAudio && (
            <MobileSelectField
              label="Voice"
              title="Select Voice"
              items={voiceItems}
              onSelect={(item) => {
                if (item.action) setUi({ selectedVoiceId: item.action });
              }}
            />
          )}
          {styleSupported && (
            <div className="rounded-[3px] border border-ui-panel-border bg-ui-controls px-3 py-1.5">
              <StylePromptRow
                value={ui.stylePrompt}
                onChange={setStylePrompt}
                className="border-t-0 pt-0"
              />
            </div>
          )}
          {(hasInstrumental || hasKeepLyrics || hasLoopable) && (
            <div className="flex flex-wrap items-center gap-2">
              {toggleButtons}
            </div>
          )}
          {(hasBpm || hasMusicalKey) && (
            <>
              <MobileFieldButton
                label="Beat & Key"
                value={beatSummary || "Auto"}
                onClick={() => setIsBeatDrawerOpen(true)}
              />
              <SettingsDrawer
                open={isBeatDrawerOpen}
                onOpenChange={setIsBeatDrawerOpen}
                title="Beat & Key"
              >
                {hasBpm && (
                  <DrawerSection label="BPM">
                    <MobileSliderRow
                      valueLabel={ui.bpm === null ? "Auto" : `${ui.bpm}`}
                      min={AUDIO_BPM_MIN}
                      max={AUDIO_BPM_MAX}
                      step={1}
                      value={ui.bpm ?? 120}
                      onChange={(bpm) => setUi({ bpm })}
                      onReset={
                        ui.bpm !== null ? () => setUi({ bpm: null }) : undefined
                      }
                    />
                  </DrawerSection>
                )}
                {hasMusicalKey && (
                  <DrawerSection label="Musical key">
                    <DrawerOptionList
                      items={MUSICAL_KEYS.map((key) => ({
                        label: key.label,
                        selected: key.value === ui.musicalKey,
                        action: key.value,
                      }))}
                      onSelect={(item) => {
                        if (item.action) setUi({ musicalKey: item.action });
                      }}
                    />
                  </DrawerSection>
                )}
              </SettingsDrawer>
            </>
          )}
          {hasTuning && (
            <>
              <MobileFieldButton
                label="Tuning"
                value={tuningSummary || "Default"}
                onClick={() => setIsTuningDrawerOpen(true)}
              />
              <SettingsDrawer
                open={isTuningDrawerOpen}
                onOpenChange={setIsTuningDrawerOpen}
                title="Tuning"
              >
                {!!sampleRateOptions?.length && (
                  <DrawerSection label="Sample rate">
                    <DrawerOptionList
                      items={sampleRateOptions.map((hz) => ({
                        label: formatSampleRateHz(hz),
                        selected: hz === sampleRateHz,
                        action: String(hz),
                      }))}
                      onSelect={(item) => {
                        if (item.action)
                          setUi({ sampleRateHz: Number(item.action) });
                      }}
                    />
                  </DrawerSection>
                )}
                {hasSpeed && (
                  <DrawerSection label="Speed">
                    <MobileSliderRow
                      valueLabel={`${speed.toFixed(2)}×`}
                      min={AUDIO_SPEED_MIN}
                      max={AUDIO_SPEED_MAX}
                      step={0.05}
                      value={speed}
                      onChange={(v) => setUi({ speed: v })}
                    />
                  </DrawerSection>
                )}
                {hasVolume && (
                  <DrawerSection label="Volume">
                    <MobileSliderRow
                      valueLabel={`${volume.toFixed(2)}×`}
                      min={AUDIO_VOLUME_MIN}
                      max={AUDIO_VOLUME_MAX}
                      step={0.05}
                      value={volume}
                      onChange={(v) => setUi({ volume: v })}
                    />
                  </DrawerSection>
                )}
                {hasPitch && (
                  <DrawerSection label="Pitch">
                    <MobileSliderRow
                      valueLabel={`${pitch > 0 ? "+" : ""}${pitch} st`}
                      min={AUDIO_PITCH_MIN}
                      max={AUDIO_PITCH_MAX}
                      step={1}
                      value={pitch}
                      onChange={(v) => setUi({ pitch: v })}
                    />
                  </DrawerSection>
                )}
              </SettingsDrawer>
            </>
          )}
        </>
      }
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <CreateMediaPageShell
      title="Create Audio - ArtCraft"
      description="Generate music and sound effects with ArtCraft"
      authChecked={authChecked}
      hasContent={hasContent}
      emptyStateTitle="Create Audio"
      emptyStateSubtitle="Describe a song, a sound, or a sample. Hear it in minutes."
      emptyStateCta={
        loggedIn ? undefined : (
          <Button
            variant="primary"
            onClick={openSignupCta}
            icon={SparklesIcon}
            className="h-12 px-6"
          >
            Sign up to create
          </Button>
        )
      }
      bottomOffset={promptHeight + 24}
      modelItems={modelItems}
      onModelChange={handleModelChange}
      promptForm={mobileForm}
      gridContent={
        <GenerationGallery
          inProgressJobs={jobs.inProgress}
          failedJobs={jobs.failed}
          onDismissFailed={jobs.dismissFailed}
          newlyCompletedItems={[...localCompletedItems, ...jobs.newlyCompleted]}
          galleryItems={gallery.items}
          newlyCompletedTokens={newlyCompletedTokens}
          hasMore={gallery.hasMore}
          isLoading={gallery.isLoading}
          isInitialLoading={gallery.isInitialLoading}
          onLoadMore={gallery.loadMore}
          onGalleryItemClick={lightbox.handleGalleryItemClick}
        />
      }
      promptBox={
        <div
          ref={promptBoxRef}
          className="animate-fade-in-up fixed bottom-2 sm:bottom-3 right-0 z-30 mx-auto max-w-6xl px-2 sm:px-4 transition-[left] duration-200 ease-linear"
          style={{
            animationDelay: "150ms",
            left: "var(--ac-sidebar-offset, 0px)",
          }}
        >
          <PromptBox
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={handleGenerate}
            isSubmitting={isGenerating}
            disabled={!canGenerate}
            credits={displayCredits}
            placeholder={
              isFishAudio
                ? "Enter text to convert to speech..."
                : "Describe the music or sound you want..."
            }
            supportsImagePrompts={imageRefsSupported}
            maxImagePromptCount={maxImageRefs}
            referenceImages={referenceImages}
            onReferenceImagesChange={handleReferenceImagesChange}
            onPickFromLibrary={() => setIsImagePickerOpen(true)}
            audioRefsSupported={audioRefsSupported}
            referenceAudios={referenceAudios}
            onReferenceAudiosChange={handleReferenceAudiosChange}
            maxAudioCount={maxAudioRefs}
            maxAudioRefDuration={AUDIO_REF_MAX_DURATION_SECONDS}
            onPickAudioFromLibrary={() => setIsAudioPickerOpen(true)}
            onClearAllExtras={() => setStylePrompt("")}
            hasClearableExtras={ui.stylePrompt.length > 0}
            secondaryPromptRow={
              styleSupported ? (
                <StylePromptRow
                  value={ui.stylePrompt}
                  onChange={setStylePrompt}
                />
              ) : undefined
            }
            modelSelector={
              <Tooltip
                content="Model"
                position="top"
                className="z-50"
                closeOnClick
              >
                <PopoverMenu
                  items={modelItems}
                  onSelect={handleModelChange}
                  mode="toggle"
                  panelTitle="Select Model"
                  panelClassName="w-[360px]"
                  richList
                  triggerIcon={
                    <img
                      src={getCreatorIconPathForModelId(
                        selectedModel?.model ?? "",
                      )}
                      alt=""
                      className="h-4 w-4 icon-auto-contrast"
                    />
                  }
                />
              </Tooltip>
            }
            leftToolbar={leftToolbar}
            rightToolbar={
              missingRequiredAudioRef ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-500 animate-pulse">
                  Audio track required
                </span>
              ) : undefined
            }
          />
        </div>
      }
      modals={
        <>
          <GalleryModal
            mode="select"
            isOpen={isImagePickerOpen}
            onClose={() => setIsImagePickerOpen(false)}
            selectedItemIds={pickerSelectedIds}
            disabledItemIds={usedImageTokens}
            onSelectItem={handlePickerSelect}
            maxSelections={maxImageRefs}
            onUseSelected={handleLibraryImageSelect}
            forceFilter="image"
            hideFilter
          />
          <GalleryModal
            mode="select"
            isOpen={isAudioPickerOpen}
            onClose={() => setIsAudioPickerOpen(false)}
            selectedItemIds={audioPickerSelectedIds}
            disabledItemIds={usedAudioTokens}
            onSelectItem={handleAudioPickerSelect}
            maxSelections={audioPickerMax}
            onUseSelected={handleLibraryAudioSelect}
            forceFilter="audio"
            hideFilter
          />
          <Lightbox
            isOpen={lightbox.lightboxOpen}
            onClose={lightbox.closeLightbox}
            mediaToken={lightbox.lightboxItem?.id}
            cdnUrl={lightbox.lightboxItem?.fullImage}
            mediaClass={lightbox.lightboxItem?.mediaClass}
            batchImageToken={lightbox.lightboxItem?.batchImageToken}
            showBatchCarousel={false}
            onNavigatePrev={lightbox.navigatePrev}
            onNavigateNext={lightbox.navigateNext}
            onDeleted={gallery.removeItem}
          />
        </>
      }
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface MobileSliderRowProps {
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  onReset?: () => void;
}

function MobileSliderRow({
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  onReset,
}: MobileSliderRowProps) {
  return (
    <div className="px-1 py-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium tabular-nums text-base-fg">
          {valueLabel}
        </span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="bg-white/5 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-base-fg/60 transition-colors hover:bg-white/10 hover:text-base-fg"
          >
            Auto
          </button>
        )}
      </div>
      <SliderV2
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        variant="filled"
      />
    </div>
  );
}
