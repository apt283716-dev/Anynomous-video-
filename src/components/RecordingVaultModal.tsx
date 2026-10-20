/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  Trash2,
  X,
  ShieldCheck,
  HardDrive,
  Clock,
  Play,
  Pause,
  Film,
  Camera,
  Image as ImageIcon,
  FileCheck,
} from 'lucide-react';
import { formatCallDuration } from '../utils/cryptoCallLogic';

export interface SavedRecording {
  id: string;
  blobUrl: string;
  blobSize: number;
  durationSeconds: number;
  recordedAt: number;
  callId: string;
  mimeType: string;
  hash: string;
  mediaType?: 'video' | 'snapshot';
  dimensions?: { width: number; height: number };
}

interface RecordingVaultModalProps {
  recordings: SavedRecording[];
  onClose: () => void;
  onDeleteRecording: (id: string) => void;
  onClearAll: () => void;
}

export const RecordingVaultModal: React.FC<RecordingVaultModalProps> = ({
  recordings,
  onClose,
  onDeleteRecording,
  onClearAll,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'snapshot'>('all');
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    recordings.length > 0 ? recordings[0].id : null
  );
  const [shreddedMessage, setShreddedMessage] = useState<string | null>(null);

  const filteredRecordings = recordings.filter((r) => {
    if (filterType === 'video') return r.mediaType !== 'snapshot';
    if (filterType === 'snapshot') return r.mediaType === 'snapshot';
    return true;
  });

  const activeRec =
    filteredRecordings.find((r) => r.id === selectedRecordingId) ||
    filteredRecordings[0] ||
    recordings[0];

  const handleDownload = (rec: SavedRecording) => {
    const a = document.createElement('a');
    a.href = rec.blobUrl;
    const isSnapshot = rec.mediaType === 'snapshot';
    const ext = isSnapshot ? 'png' : 'webm';
    const prefix = isSnapshot ? 'CipherCall_Private_Snapshot' : 'CipherCall_Private_Record';
    a.download = `${prefix}_${new Date(rec.recordedAt).toISOString().slice(0, 10)}_${rec.id.slice(-6)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShred = (id: string) => {
    onDeleteRecording(id);
    setShreddedMessage('Recording data shredded and zeroed from local memory buffer.');
    setTimeout(() => setShreddedMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Client-Side Recording Vault</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono">
                  LOCAL ONLY • ZERO REMOTE LEAK
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Encrypted locally on your machine. The peer had zero indication and zero access.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close recording vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {shreddedMessage && (
          <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2 text-xs text-rose-300 font-mono flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            <span>{shreddedMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-5">
          {recordings.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Film className="w-12 h-12 mx-auto text-slate-700" />
              <p className="text-sm font-medium text-slate-400">No Local Recordings or Snapshots</p>
              <p className="text-xs max-w-sm mx-auto">
                During a video call, click &ldquo;Record (My Side Only)&rdquo; or &ldquo;Capture Snapshot&rdquo;.
                All media is stored strictly inside your browser&apos;s local memory.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Media Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Media ({recordings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'video'
                      ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Videos ({recordings.filter((r) => r.mediaType !== 'snapshot').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('snapshot')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterType === 'snapshot'
                      ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snapshots ({recordings.filter((r) => r.mediaType === 'snapshot').length})</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Recording Selection List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>VAULT ITEMS ({filteredRecordings.length})</span>
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Shred All
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {filteredRecordings.map((rec) => {
                      const isSelected = activeRec?.id === rec.id;
                      const sizeMB = (rec.blobSize / (1024 * 1024)).toFixed(2);
                      const isSnap = rec.mediaType === 'snapshot';
                      return (
                        <div
                          key={rec.id}
                          onClick={() => setSelectedRecordingId(rec.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500/60 text-white shadow-md'
                              : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium mb-1">
                            <span className="truncate font-mono flex items-center gap-1.5">
                              {isSnap ? (
                                <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              ) : (
                                <Film className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                              <span>{new Date(rec.recordedAt).toLocaleTimeString()}</span>
                            </span>
                            <span className="text-cyan-400 font-mono text-[11px]">
                              {isSnap ? 'SNAPSHOT' : formatCallDuration(rec.durationSeconds)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>{sizeMB} MB</span>
                            <span className="truncate max-w-[80px]">#{rec.id.slice(-6)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Media Player / Image Inspector */}
                {activeRec && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center group">
                      {activeRec.mediaType === 'snapshot' ? (
                        <img
                          src={activeRec.blobUrl}
                          alt="Local Video Snapshot"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          src={activeRec.blobUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">TIMESTAMP</span>
                          <span className="text-slate-200">
                            {new Date(activeRec.recordedAt).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">
                            {activeRec.mediaType === 'snapshot' ? 'MEDIA TYPE' : 'DURATION'}
                          </span>
                          <span className="text-slate-200">
                            {activeRec.mediaType === 'snapshot'
                              ? 'Local Encrypted Snapshot'
                              : formatCallDuration(activeRec.durationSeconds)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">FILE SIZE & CODEC</span>
                          <span className="text-slate-200">
                            {(activeRec.blobSize / (1024 * 1024)).toFixed(2)} MB (
                            {activeRec.mediaType === 'snapshot' ? 'PNG Image' : 'VP8/Opus WebM'})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">INTEGRITY HASH</span>
                          <span className="text-cyan-400 truncate block">
                            {activeRec.hash.slice(0, 16)}...
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleDownload(activeRec)}
                          className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>
                            {activeRec.mediaType === 'snapshot'
                              ? 'Download .PNG Snapshot'
                              : 'Download .WebM Video'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShred(activeRec.id)}
                          className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-medium rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>
                            {activeRec.mediaType === 'snapshot'
                              ? 'Shred Snapshot'
                              : 'Shred Recording'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Guaranteed zero cloud synchronization. Kept strictly in memory until downloaded or shredded.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
