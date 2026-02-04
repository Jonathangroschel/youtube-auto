import { ChevronRight, Play, SkipBack, SkipForward, Volume2, Maximize, Upload, Type, Wand2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function EditorPreview() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Full control with our AI video editor.
            <br />
            <span className="text-[#9aed00]">Feels like magic.</span>
          </h2>
          <Button
            asChild
            className="mt-4 bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-6 py-3 text-sm font-bold"
          >
            <a href="#waitlist">
              Join Waitlist
              <ChevronRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Editor Preview Mockup */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-lg bg-white">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">streamer-video</span>
              <span className="text-xs text-gray-400">Draft</span>
            </div>
            <Button size="sm" className="bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-lg px-4 text-xs">
              Export Video
            </Button>
          </div>

          <div className="flex">
            {/* Left Sidebar */}
            <div className="w-16 border-r border-gray-100 bg-gray-50 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:text-[#1a1240] cursor-pointer">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-50 border border-[#9aed00] flex items-center justify-center text-[#1a1240] cursor-pointer">
                  <Type className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:text-[#1a1240] cursor-pointer">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:text-[#1a1240] cursor-pointer">
                  <Settings className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Subtitles Panel */}
            <div className="w-64 border-r border-gray-100 p-4 hidden md:block">
              <div className="bg-green-50 border border-[#9aed00] rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4 text-[#1a1240]" />
                  <span className="text-sm font-medium text-[#1a1240]">AI Subtitles</span>
                </div>
                <p className="text-xs text-gray-500">Automatically recognize speech and add subtitles</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Manual Subtitles</span>
                </div>
                <p className="text-xs text-gray-500">Add subtitles manually with custom timing</p>
              </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 p-4">
              {/* Video Preview */}
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                <Image
                  src="/theo-photo.png"
                  alt="Video preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover"
                />
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <SkipBack className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <div className="w-10 h-10 rounded-full bg-[#9aed00] flex items-center justify-center cursor-pointer">
                  <Play className="w-5 h-5 text-[#1a1240] fill-[#1a1240]" />
                </div>
                <SkipForward className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <span className="text-xs text-gray-500 ml-4">00:07:40 / 00:57:42</span>
                <div className="flex items-center gap-2 ml-auto">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <div className="w-20 h-1 bg-gray-200 rounded-full">
                    <div className="w-3/4 h-full bg-[#9aed00] rounded-full"></div>
                  </div>
                  <Maximize className="w-4 h-4 text-gray-500 ml-2" />
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center text-xs text-gray-400 mb-2">
                  <span>0s</span>
                  <span className="ml-auto">5s</span>
                  <span className="ml-auto">10s</span>
                  <span className="ml-auto">15s</span>
                  <span className="ml-auto">20s</span>
                  <span className="ml-auto">25s</span>
                  <span className="ml-auto">30s</span>
                </div>
                <div className="space-y-2">
                  <div className="h-6 bg-[#9aed00] rounded flex items-center px-2">
                    <span className="text-xs text-[#1a1240]">WHAT EVER THE F*CK YOU DOING</span>
                  </div>
                  <div className="h-6 bg-purple-200 rounded flex items-center px-2">
                    <span className="text-xs text-[#1a1240]">Video</span>
                  </div>
                  <div className="h-6 bg-blue-100 rounded flex items-center px-2">
                    <span className="text-xs text-[#1a1240]">Watermark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
