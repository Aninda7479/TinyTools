import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, Brain, Shield, Scissors, RefreshCw, QrCode,
  Wand2, Layers, FileText, Key, Binary, Hash, Lock,
  Paintbrush, Minimize, FileUp, Stamp, ArrowUpDown, RotateCw, Crop,
  Trash2, ImagePlus, Unlock, Minimize2, Info, Eye,
  Gauge, Zap, SplitSquareHorizontal, Combine, Palette,
  ShieldCheck, FileLock, Film, Merge, VolumeX, Volume2, Globe,
  Image as ImageIcon, Subtitles, Download,
  Calculator, Activity, Clock, Ruler, Sigma,
  MessageCircle, X, ChevronRight,
} from "lucide-react";
import type { Tool } from "./Sidebar";
import { searchFeatures } from "../lib/search";

const spring = { type: "spring" as const, stiffness: 320, damping: 28 };

interface Feature {
  icon: typeof Brain;
  title: string;
  tag: string;
  tool: Tool;
  sub?: string;
  keywords: string;
  image?: string;
}

const sections: { label: string; icon: typeof Brain; features: Feature[] }[] = [
  {
    label: "AI",
    icon: Brain,
    features: [
      {
        icon: Brain,
        title: "Bg remove",
        tag: "AI",
        tool: "ai",
        sub: "bg-remove",
        keywords: "background remove transparent cutout ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBBDLHhcIFRxXmTodVOw27OI2bqNx0X533dbWA-f7xq1Kp2dNaLbCS1Um-7QQ4nlXc5juGbzU8lCnUDQyY9MCLBr0Jw8d2kklV5GPOhn1h20mVbavxAJz6cA_YlCKU9Mx3sYCNtCkMEbw4plO8s6xFUSnkso5trGT3T0q7AcY5jnbpaX214lEyQ0VrSw9DKAUaF4AUY4N6E2SXUc9ddjoUFa6TxTBSCYD-HDN1K7VVe3nQNlyxP58Rj8Q",
      },
      {
        icon: Zap,
        title: "Upscale",
        tag: "AI",
        tool: "ai",
        sub: "upscale",
        keywords: "upscale enhance resolution 2x 4x ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD6OT00TOWz8VW_Rv5Odv3GI68VIQ7LiUnyQzRya1gFoyuD8cAy1ZdBJJeoUtbKc173ZeS6Sa222ol3mwVihaJMd09mwPB_dXSnmgF5__NEpfiFvNoWAjG9oazE0XW6uTDSVavC_G6qay65LUYijzHdRzgVTH5r2M5Xg2GcTtdxbsVYyfppCtx8cVsHN53KLrzbcg2T1fBScxkdoBsxiGNC7kZFBH5CKakckqLMF-zr8EBQb2N_JZvQLA",
      },
      {
        icon: Paintbrush,
        title: "Inpaint",
        tag: "AI",
        tool: "ai",
        sub: "inpaint",
        keywords: "inpaint fill remove object repair ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBiI78bUH6xlaKbumjUiceMSkbeTe_FxTbFiSrO7CPH0dr2AmYAS5bfUdVGnMiWUdl3bID4-8Jfzd-_cSO1LTcGLFzZYDIjauE4h2kfpGOqTYaGQgUTg0ZFdhrWA19-HWIOnXvilMdGrs3c_Q8XoV6aE1lU0RsnVr4vI-j3OaQdABytb47K2RaeTBwJW7jRR9PYiIrmwseYMboF7X58HWrhzL7unnrUltteSihW92V8Qf8SUzypdDa7Ew",
      },
      {
        icon: Palette,
        title: "Sepia tone",
        tag: "AI",
        tool: "ai",
        sub: "sepia",
        keywords: "sepia vintage tone warm filter ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrHb6OgQH80TKlu65hvEyoftcOeAYwtx0BdfLPNQtnQZ6kSMr8O-jFyjG0u4INCVSS5l_PhsNN9Wg0uX0rMoRhyP093zACWNRm-gYrRHth5K-fDzWpZEqSM4Te1IDKx45PYn7_drJ2Es-AmyjbkGmmuR8tBr-Eop98lrfZa8pw3UakxEJveFiJYDaV7leXN5O2-xgVQORHEjatbgyuyYCvAsDY9p-2XaUZkG1tkwe7C5UPV2qn7pcd9g",
      },
      {
        icon: Gauge,
        title: "Smart sharpen",
        tag: "AI",
        tool: "ai",
        sub: "smart-sharpen",
        keywords: "sharpen edge enhance detail ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBi1VDkMyTA5jKYjPHimsNI7t_5EcnGf1jcvA9WHVzH45mR-tOb_XH7g_p1B6Gg5WOKzOn6UFUBPHOVfn5X6216Z1k4jU4ohw_IU4bEfDJsGvqhejvlfqc-PshCm_ru5w325y8ZvxnJxtRgRPT4uyHq_lpEE-_-b77SEt2j14ohoyBfQTpYDI-k8lNNhRzr9CqUxS9Vwf4ccd44gTKgFNE1U3t6-yKEGaitK67FqxblCQZHbgzQuozbjA",
      },
      {
        icon: Eye,
        title: "Depth blur",
        tag: "AI",
        tool: "ai",
        sub: "depth-blur",
        keywords: "depth blur bokeh portrait ai",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA3AaGlrvksPH4RFdJWV8i-lQq_4gLEDH_lvG5NOPP53mDYNskS44-26FloMfAsUwKbcYZLda2EEMwTbotH091PfBH6700_RaVsm1RT1daONw6n9kD0uluaa-PQwRTXtZD6f1maQ33tgtH9TZC8ti6A2UZlOro-H6AoUJ5X_dTFX57yqMuvXV38xA9M_AuRY1pst9ppcoenLfscAlKky6yQfjhZRxda6oC937-0HfBQiP92vzPZJJUX1w",
      },
    ],
  },
  {
    label: "PRIVACY",
    icon: Shield,
    features: [
      {
        icon: Shield,
        title: "Strip metadata",
        tag: "Privacy",
        tool: "privacy",
        sub: "strip-metadata",
        keywords: "exif metadata strip remove gps privacy",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBLk8e-5djen1oGmY4nr7mUiN8llviznETHCsiNBGrTZvpp_CpPoWv8LplkOxMU6pRFEA_xebTHEXNJhRuLeug-oLYkwFze2ZMMiw4auTN3zACp2wvVe74cSHw73mHdl0q6gu5YM5t8et-OSoKwSK-EJwImlY0WgiWvPnbUUsoSOPZ9i2BHKr8XjxXVyATiG73m8W3gz8tP3P88BWu7Q-TMK3n3LJVsVRF7jzszrMfaXUEytqqcSsIVZg",
      },
      {
        icon: FileLock,
        title: "Redact regions",
        tag: "Privacy",
        tool: "privacy",
        sub: "redact",
        keywords: "redact blur pixelate hide sensitive privacy",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA_kUwRl0ifS9KF4aMZondJICqgqamMcA04lB_066TRsltFcbLa2RSbgwx8fvOUt8jWa_LwieVO7qo5qvDqTDFfthnzu9-_VE8nJtv8dyDPqGDUdWAVjgqntNNiHYNNRA1uWOq0rMqdEOBZ6xuOjEMJ17bSghhlMEFi2VCmgzqFT4nf9piAXb-A5CH7DGfgfIQmRo38YYjhbmR7m21uKxFkGaoegAYiEvbf_a4ZiVQrGvPkogHQ7Xr2Qg",
      },
      {
        icon: Stamp,
        title: "Watermark",
        tag: "Privacy",
        tool: "privacy",
        sub: "watermark",
        keywords: "watermark text overlay copyright privacy",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBiYNIsT4qP5aVmuz1QcYRx4GXEaWTrdZVHRXywBwxoejsJgJjLQnubg9XI6E4tIn4mwlrGYtyBsn6oRpLODUqY48lkvs5XFwkHgxlb58fo68F-JWfl4q8X_gpCCfKEV_gO2I-ACe5UW8eXm6-UFfuahfY_1h3gNW3oaYGc-QVhN1H5sPmBsSSFMe4uk2gS1EtpzI3qxpyiskwkOwFJv-S7ZCW5Dfjwfpvnnmy1BNVDhbeDX_GXKyBNWQ",
      },
    ],
  },
  {
    label: "EDIT",
    icon: Scissors,
    features: [
      {
        icon: Scissors,
        title: "Smart crop",
        tag: "Edit",
        tool: "editing",
        sub: "crop",
        keywords: "crop resize smart focus point edit",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAgiJAgTlxzcmuogBEwDAetmc8kkS4xj7RD5ggkY1sSwIvCXF7epdsYyLB520f3JR6Lpyp1m_BcHUAXC61r9ZFA2WR7qXvX1K2K_9Wy4v9JzU5-3ovgyjrwxoXb5Opww8YEawhH3yvElKKWrin5qRBBbZChaUysDWt_jE4ECwpLzmbJD3kFoElJOpHk4twMzyozzu2iLM4suxbSdtMPpAjqP2YYqeTGd-v73hLdPmuaiduCOZwZIeJepg",
      },
      {
        icon: SplitSquareHorizontal,
        title: "Expand canvas",
        tag: "Edit",
        tool: "editing",
        sub: "expand",
        keywords: "expand canvas pad border padding edit",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAK_fQXR6oP1a1udS9S5p-XRS-zLVK0ECcWXjjhZDjadud7_XRH1XnjhmOTw_5-W4Y28luOW0P3t2kYgCws3YzIXmk7dNScKy46AWa_Is5fdLNpgC42Pp1prbpLuw8tHtVAARtThOeMNwYbxSJu1DTlPBwZ3RPTtmOG5HyqkDxyxXN_Q8O8Q3WujTZ9AdXxQd8VQAfSBAzHDk80s_Z0Q8iHO6G7DwF4YlOkqXSVeHRivTLAMa8nCQVp3w",
      },
      {
        icon: Combine,
        title: "Split image",
        tag: "Edit",
        tool: "editing",
        sub: "split",
        keywords: "split divide grid cut tiles edit",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4iUeBbzCtYyl5d1H7dJXPpR3AADxYTTYZywhR5OeSKJhcAetp01dgWkIcx-Em2OPbI258O2RpUKU6ylQtx15CcRhqfe1441cee-Tah5DL9Yj_8LSNBtacSp_VWYdM70nkl6dwO5fgZmcNyGHj5r9MZ9M9t_iO073G0-D5rvj1k2FuOuCIcV-JGitaVOZ_O59FZUB50KS3u7znNVmzxZbqIV7om_kYSefh476Sib_NRbgu9IsFtsA8tg",
      },
      {
        icon: Layers,
        title: "Stitch images",
        tag: "Edit",
        tool: "editing",
        sub: "stitch",
        keywords: "stitch combine merge join edit",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDftPiaeOGRTBR1G1JRygZ2RkEXOO8wuccqA11Zo3zCIEZkEqmVLEfnP2TSryFL3Y_lHEV01zxnYYrKBZxELEIaMH0SyZ80ue92TkswSnjLtNXobcsrBXBXxdadCWlZBpGmliLfWOP0RZPzKfb6vj9BZfAR7kNzs0gg89K0ydjSiKwsb6IcvL2z25_dOoblIfURMPwcMohYMuJ0obhhY2d27JkcKG1YYaWs0aDKtZ3sSi2BY0DdF062PA",
      },
    ],
  },
  {
    label: "CONVERT",
    icon: Minimize,
    features: [
      {
        icon: Minimize,
        title: "Compress",
        tag: "Convert",
        tool: "compress",
        keywords: "compress reduce size optimize quality convert",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBuVKZYOBESIu-VePqH63DSV8-6bLrzBQEZ7lXvU424ya2dPHxLcFGC5WBs8Rwc_3th9aYSi3X9UHwxCidHsA-WXLffxqSHfRvz3moMeW4oelEgVqvgicDgh5GszPjgRu4_JlYug5AOK95bNvtpXyXU8wfHZ1lQfYnN-f83lbkrQEE46EIqtPkj-lpQGuB5anSuuQ5tuWorGyMeuRjr5bD9TH-jk98AL1m-4smpUFHF_cwz4SoVg_4ADg",
      },
      {
        icon: RefreshCw,
        title: "Format convert",
        tag: "Convert",
        tool: "conversion",
        sub: "convert",
        keywords: "convert format png jpg webp",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDzxid0OTrb6JJ0Kd35jDm9Hnb_8LmJlSwUc7aMR9Is1kimcgBfOqVRqAGFY-3HY6EtXidPZTnii_9M8DL2QA91e43QQ7SQzpUlwEuL_e1eEVdQu12IebK23CeNlghpAdU9QXWjn9shDalsUEWwQ2tHRQFOnIBRI36morrjug7HSfb-yCEcP4RfSYsg2UKneDe9jzc3Vz7Ilj6Q52LzKXO-tQGLz9Ek-MTagMiAQ8ZdaoDvFlO7q7oPiw",
      },
      {
        icon: FileUp,
        title: "HEIC convert",
        tag: "Convert",
        tool: "conversion",
        sub: "heic",
        keywords: "heic heif convert apple iphone",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCyRc50zFXi0WT1_AzNm8dwpcF51AH0WWSA6ziTLaBQPVBXGuURYYeFZL3FQn9EtbZnqls2TUJajZowAxZYoSDXCsPgR2FGW39KlfeFIKBXD5mBiO4iyunDAzrOvh5vL8J83f2Vs8Kqf7XCZ9y9AiyQriq1ChxNPfdqC5bBdr403qf8mZUrUsLH4uspHx9as8nxaRgn3lgm2lck2Lvqfosb4nCT4ZhST70byn3TxJtqtMo4tpFngJujUQ",
      },
      {
        icon: Wand2,
        title: "Smart compress",
        tag: "Convert",
        tool: "conversion",
        sub: "compress",
        keywords: "smart compress target size quality",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnXWxJluqo5ygWPNON-VprFu5OHsBaCYkLLie85FsE24wgpgIMQV53Lpw5NPKB5JYsYd5hw_5_Pnx0d3K-xIpPIU4hkUt8hpjdRQ-4cFgzEjXtYiqPqP4uQX7OopMX7P49qEkLWobIFaR592sAi_htscWKaqCOpKghTIoqlGBvyM0Ytbaluc_1F0n6cg8ArxfS3z4tS6_7eTwaQdHrKzdBNv3ddug_NMLmZ2D9a2kxx0CZBE-Zn8OaRw",
      },
      {
        icon: Paintbrush,
        title: "Raster to SVG",
        tag: "Convert",
        tool: "conversion",
        sub: "vectorize",
        keywords: "vectorize svg trace raster",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNbyiEIBYy_ZLbOod7c8KDXmbPwcQK5yF2zjiTT3al2dmUqRN3_AmpKA36pZ5j_Ps-tAUfvugPwY-Q7pbqRfLYLsDRj7E68ngAETT2rG_1U3RwVMdZej7bB50oL_LeW3BIpPR0m4NvexRbrh13QS79gz-gkcsgog9-qriseIYIineOdhwa2v5YwgcjAZdmaQrvre5Wp3P9oUeT9H7C6q38HwxrME4Ox9REFx-ZBV0W2aJF1xT7JkqL-w",
      },
    ],
  },
  {
    label: "VIDEO",
    icon: Film,
    features: [
      { icon: Info, title: "Video info", tag: "Info", tool: "video", sub: "info", keywords: "video info metadata codec bitrate fps", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80" },
      { icon: ArrowUpDown, title: "Compress", tag: "Compress", tool: "video", sub: "compress", keywords: "video compress reduce size quality", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&auto=format&fit=crop&q=80" },
      { icon: ArrowUpDown, title: "Resize", tag: "Compress", tool: "video", sub: "resize", keywords: "video resize 1080p 720p 480p scale", image: "https://images.unsplash.com/photo-1579632652768-6cb9dcf85912?w=400&auto=format&fit=crop&q=80" },
      { icon: RefreshCw, title: "Aspect ratio", tag: "Compress", tool: "video", sub: "aspect", keywords: "aspect ratio 16:9 9:16 1:1 vertical horizontal", image: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=400&auto=format&fit=crop&q=80" },
      { icon: Scissors, title: "Trim / Cut", tag: "Edit", tool: "video", sub: "trim", keywords: "video trim cut lossless precision", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80" },
      { icon: Merge, title: "Merge clips", tag: "Edit", tool: "video", sub: "merge", keywords: "video merge join combine clips", image: "https://images.unsplash.com/photo-1579632652768-6cb9dcf85912?w=400&auto=format&fit=crop&q=80" },
      { icon: Crop, title: "Crop frame", tag: "Edit", tool: "video", sub: "crop", keywords: "video crop frame remove black bars", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&auto=format&fit=crop&q=80" },
      { icon: RotateCw, title: "Rotate", tag: "Edit", tool: "video", sub: "rotate", keywords: "video rotate 90 180 270 fix sideways", image: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=400&auto=format&fit=crop&q=80" },
      { icon: RefreshCw, title: "Mirror / Flip", tag: "Edit", tool: "video", sub: "mirror", keywords: "video mirror flip horizontal vertical", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80" },
      { icon: Film, title: "Convert format", tag: "Format", tool: "video", sub: "format", keywords: "video convert mp4 mkv webm avi mov", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&auto=format&fit=crop&q=80" },
      { icon: Volume2, title: "Extract audio", tag: "Audio", tool: "video", sub: "extract-audio", keywords: "extract audio strip mp3 wav aac", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80" },
      { icon: VolumeX, title: "Mute video", tag: "Audio", tool: "video", sub: "mute", keywords: "mute video remove audio silent", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80" },
      { icon: Volume2, title: "Replace audio", tag: "Audio", tool: "video", sub: "replace-audio", keywords: "replace audio swap custom track", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80" },
      { icon: ImageIcon, title: "Video → GIF", tag: "GIF", tool: "video", sub: "to-gif", keywords: "video to gif high quality palette", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80" },
      { icon: Film, title: "GIF → Video", tag: "GIF", tool: "video", sub: "from-gif", keywords: "gif to video mp4 convert lightweight", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&auto=format&fit=crop&q=80" },
      { icon: Gauge, title: "Speed control", tag: "Advanced", tool: "video", sub: "speed", keywords: "video speed slow motion fast forward", image: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=400&auto=format&fit=crop&q=80" },
      { icon: Stamp, title: "Watermark", tag: "Advanced", tool: "video", sub: "watermark", keywords: "video watermark text overlay", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80" },
      { icon: Subtitles, title: "Burn subtitles", tag: "Advanced", tool: "video", sub: "subtitles", keywords: "burn subtitles srt vtt embed", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&auto=format&fit=crop&q=80" },
      { icon: ImageIcon, title: "Frame extract", tag: "Advanced", tool: "video", sub: "frames", keywords: "extract frames png jpg snapshot", image: "https://images.unsplash.com/photo-1579632652768-6cb9dcf85912?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "AUDIO",
    icon: Volume2,
    features: [
      { icon: Volume2, title: "Text to speech", tag: "Speech", tool: "tts", keywords: "text to speech tts voice read audio speak local", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "QR CODE",
    icon: QrCode,
    features: [
      { icon: QrCode, title: "QR generator", tag: "Create", tool: "qr", keywords: "qr code generate custom logo gradient", image: "https://images.unsplash.com/photo-1595079672139-cee25695f5a7?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "PDF",
    icon: FileText,
    features: [
      { icon: Info, title: "PDF info", tag: "Info", tool: "pdf", sub: "info", keywords: "pdf info metadata pages size version", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Layers, title: "Merge PDFs", tag: "Pages", tool: "pdf", sub: "merge", keywords: "merge combine join pdf files", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Scissors, title: "Split & extract", tag: "Pages", tool: "pdf", sub: "split", keywords: "split extract separate pages", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: ArrowUpDown, title: "Reorder pages", tag: "Pages", tool: "pdf", sub: "reorder", keywords: "reorder rearrange sort pages", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: RotateCw, title: "Rotate pages", tag: "Pages", tool: "pdf", sub: "rotate", keywords: "rotate pages 90 180 270", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Crop, title: "Crop pages", tag: "Pages", tool: "pdf", sub: "crop", keywords: "crop trim margins pages", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Trash2, title: "Delete pages", tag: "Pages", tool: "pdf", sub: "delete", keywords: "delete remove pages", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: ImagePlus, title: "Images to PDF", tag: "Convert", tool: "pdf", sub: "img2pdf", keywords: "images photos to pdf convert", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: FileText, title: "Extract text", tag: "Convert", tool: "pdf", sub: "text", keywords: "extract text content copy", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Lock, title: "Encrypt PDF", tag: "Security", tool: "pdf", sub: "encrypt", keywords: "encrypt password protect lock", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
      { icon: Unlock, title: "Decrypt PDF", tag: "Security", tool: "pdf", sub: "decrypt", keywords: "decrypt unlock remove password", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
      { icon: Minimize2, title: "Compress PDF", tag: "Enhance", tool: "pdf", sub: "compress", keywords: "compress reduce size optimize", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Minimize2, title: "Flatten PDF", tag: "Enhance", tool: "pdf", sub: "flatten", keywords: "flatten form fields", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Stamp, title: "Add watermark", tag: "Enhance", tool: "pdf", sub: "watermark", keywords: "watermark text overlay", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
      { icon: Hash, title: "Page numbers", tag: "Enhance", tool: "pdf", sub: "pagenum", keywords: "page numbers stamp header footer", image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "SECURITY",
    icon: Lock,
    features: [
      { icon: Key, title: "Password generator", tag: "Generate", tool: "password", keywords: "password generator random secure passphrase pin", image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400&auto=format&fit=crop&q=80" },
      { icon: Lock, title: "AES-256-GCM", tag: "Text", tool: "encryption", sub: "text-aes", keywords: "aes encrypt decrypt text strong", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
      { icon: Lock, title: "ChaCha20-Poly1305", tag: "Text", tool: "encryption", sub: "text-chacha", keywords: "chacha20 encrypt decrypt text modern", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
      { icon: Hash, title: "Classic ciphers", tag: "Text", tool: "encryption", sub: "text-classic", keywords: "rot13 caesar vigenere xor cipher", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: FileLock, title: "File AES encrypt", tag: "File", tool: "encryption", sub: "file-aes", keywords: "aes file encrypt decrypt password", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
      { icon: FileLock, title: "File ChaCha encrypt", tag: "File", tool: "encryption", sub: "file-chacha", keywords: "chacha file encrypt decrypt", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "ENCODE / DECODE",
    icon: Binary,
    features: [
      { icon: Binary, title: "Base64", tag: "Encode", tool: "encoder", sub: "base64", keywords: "base64 encode decode standard", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Base64URL", tag: "Encode", tool: "encoder", sub: "base64url", keywords: "base64url url-safe encode decode", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Base32", tag: "Encode", tool: "encoder", sub: "base32", keywords: "base32 encode decode", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Base58", tag: "Encode", tool: "encoder", sub: "base58", keywords: "base58 bitcoin crypto encode decode", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Hex", tag: "Encode", tool: "encoder", sub: "hex", keywords: "hexadecimal base16 encode decode", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "URL encode", tag: "Encode", tool: "encoder", sub: "url", keywords: "url percent encoding uri", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "HTML entities", tag: "Encode", tool: "encoder", sub: "html", keywords: "html entities special characters", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Unicode escape", tag: "Encode", tool: "encoder", sub: "unicode", keywords: "unicode utf-8 escape sequences", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "JWT decoder", tag: "Encode", tool: "encoder", sub: "jwt", keywords: "jwt json web token decode", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Morse code", tag: "Encode", tool: "encoder", sub: "morse", keywords: "morse code dots dashes translate", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Binary", tag: "Encode", tool: "encoder", sub: "binary", keywords: "binary base2 01 text converter", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
      { icon: Binary, title: "Octal", tag: "Encode", tool: "encoder", sub: "octal", keywords: "octal base8 text converter", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "HASH",
    icon: Hash,
    features: [
      { icon: Hash, title: "Text hash", tag: "Hash", tool: "hasher", sub: "text-hash", keywords: "hash text md5 sha256 blake3", image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&auto=format&fit=crop&q=80" },
      { icon: Hash, title: "File hash", tag: "Hash", tool: "hasher", sub: "file-hash", keywords: "hash file integrity checksum", image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&auto=format&fit=crop&q=80" },
      { icon: Hash, title: "All algorithms", tag: "Hash", tool: "hasher", sub: "multi-hash", keywords: "multi hash all algorithms md5 sha blake3", image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&auto=format&fit=crop&q=80" },
      { icon: ShieldCheck, title: "Verify hash", tag: "Hash", tool: "hasher", sub: "verify", keywords: "verify hash integrity check match", image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "SHARE",
    icon: Globe,
    features: [
      { icon: Globe, title: "Global share", tag: "P2P", tool: "global-share", keywords: "global share p2p direct webrtc internet world wide send", image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=80" },
      { icon: Download, title: "Global receive", tag: "P2P", tool: "global-receive", keywords: "global receive p2p direct webrtc internet world wide receive", image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=80" },
      { icon: MessageCircle, title: "Local chat", tag: "E2EE", tool: "lan-chat", keywords: "local chat lan chat local network encrypted end to end group room text image file e2ee", image: "https://images.unsplash.com/photo-1534536281715-e28d76689b4d?w=400&auto=format&fit=crop&q=80" },
      { icon: QrCode, title: "Local Web Portal Send", tag: "Network", tool: "portal-send", keywords: "local web portal send share file qr code download browser", image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=80" },
      { icon: Download, title: "Local Web Portal Receive", tag: "Network", tool: "portal-receive", keywords: "local web portal receive upload incoming file accept", image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=80" },
    ],
  },
  {
    label: "CALCULATOR",
    icon: Calculator,
    features: [
      { icon: Calculator, title: "Scientific calculator", tag: "Math", tool: "calc-sci", keywords: "scientific calculator trig sin cos tan log sqrt algebra expression math", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80" },
      { icon: Activity, title: "Graph calculator", tag: "Math", tool: "calc-graph", keywords: "graph plot function equation 2d curve plotting x y visualize", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80" },
      { icon: Clock, title: "Time calculator", tag: "Math", tool: "calc-time", keywords: "time duration add subtract convert hours minutes seconds elapsed", image: "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=400&auto=format&fit=crop&q=80" },
      { icon: Ruler, title: "Unit calculator", tag: "Math", tool: "calc-unit", keywords: "unit converter length weight temperature area volume speed data convert", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80" },
      { icon: Sigma, title: "Equation calculator", tag: "Math", tool: "calc-equation", keywords: "equation solve quadratic linear system roots formula discriminant cramer substitution math", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80" },
    ],
  },
];

// Helper to render top 16:9 visual preview image inside cards
function CardVisual({ icon: Icon, tag, title, image }: { icon: typeof Brain; tag: string; title: string; image?: string }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="h-24 bg-[#151b2d] flex items-center justify-center p-2 relative overflow-hidden group-hover:bg-[#192238] transition-colors">
      {image && !imgErr ? (
        <img
          src={image}
          alt={`${title} preview`}
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
        />
      ) : (
        /* Geometric fallback frame when image is loading or unavailable */
        <div className="w-full h-full rounded-lg border border-white/5 bg-[#0c1324]/80 flex items-center justify-center relative z-10 backdrop-blur-sm group-hover:border-[#3B82F6]/30 transition-colors shadow-inner">
          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#3B82F6]/20 transition-all duration-300">
              <Icon className="w-5 h-5 text-[#adc6ff] group-hover:text-white transition-colors" />
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#8c909f] group-hover:text-[#adc6ff] transition-colors">
              {tag}
            </span>
          </div>
        </div>
      )}

      {/* Dark gradient overlay at bottom of image container matching Night-Ops style */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1E293B] via-[#1E293B]/40 to-transparent opacity-90 z-20 pointer-events-none" />
    </div>
  );
}

export default function Welcome({ onNavigate }: { onNavigate: (tool: Tool, sub?: string) => void }) {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    return searchFeatures(query, sections);
  }, [query]);

  return (
    <div className="flex flex-col h-full bg-[#0c1324] text-[#dce1fb] font-hanken p-4 sm:p-6 overflow-hidden">
      {/* Top Header & Branding */}
      <header className="mb-6 shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img
              src="/logo.svg"
              alt="TinyTools Logo"
              className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]"
            />
            <h1 className="font-hanken text-2xl font-bold text-[#dce1fb] tracking-tight">
              Tiny Tools
            </h1>
          </div>
          <p className="font-hanken text-xs sm:text-sm text-[#c2c6d6]">
            Professional-grade utilities for your workflow. Fast, local & private.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f] pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search tools... (Press ESC to reset)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-white/10 bg-[#151b2d] font-mono text-xs text-[#dce1fb] placeholder-[#8c909f] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10 text-[#8c909f] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Tools Grid Canvas */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-8 pb-10">
        {filteredSections.map((section, si) => (
          <motion.section
            key={section.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: query ? 0 : si * 0.03, ...spring }}
            className="mb-section-margin"
          >
            {/* Section Tag Header */}
            <div className="flex items-center gap-2 mb-4 border-b border-[#424754]/30 pb-2">
              <h2 className="font-mono text-xs uppercase tracking-wider font-semibold text-[#c2c6d6]">
                {section.label}
              </h2>
              <span className="font-mono text-[10px] text-[#8c909f] bg-[#151b2d] px-2 py-0.5 rounded-full border border-white/5">
                {section.features.length}
              </span>
            </div>

            {/* Tool Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-card-gap">
              {section.features.map((feature, fi) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: query ? 0 : fi * 0.015, ...spring }}
                    onClick={() => onNavigate(feature.tool, feature.sub)}
                    className="tool-card bg-[#1E293B] border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-[#3B82F6] transition-all flex flex-col group shadow-lg hover:shadow-xl"
                  >
                    {/* Top 16:9 Visual Preview Header */}
                    <CardVisual icon={Icon} tag={feature.tag} title={feature.title} image={feature.image} />

                    {/* Bottom Label Area */}
                    <div className="p-3 bg-[#1E293B] flex items-center justify-between min-w-0">
                      <h4 className="font-hanken text-xs sm:text-sm font-semibold text-[#dce1fb] group-hover:text-white truncate transition-colors">
                        {feature.title}
                      </h4>
                      <ChevronRight className="w-3.5 h-3.5 text-[#8c909f] group-hover:text-[#adc6ff] group-hover:translate-x-0.5 shrink-0 transition-all ml-1" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        ))}

        {/* Empty State */}
        {query && filteredSections.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[#151b2d] border border-white/10 flex items-center justify-center mb-3 text-[#8c909f]">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-hanken text-base font-semibold text-[#dce1fb] mb-1">
              No matching tools found
            </h3>
            <p className="font-mono text-xs text-[#8c909f] max-w-sm mb-4">
              We couldn't find any tool matching "{query}". Try checking your spelling or searching for a different keyword.
            </p>
            <button
              onClick={() => setQuery("")}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Clear search
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
