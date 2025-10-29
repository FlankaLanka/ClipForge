import React, { useState, useEffect } from 'react';

interface VoiceSpriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deviceId: string, deviceName: string) => void;
  audioDevices: MediaDeviceInfo[];
  onRefreshDevices: () => void;
  isLoadingDevices: boolean;
}

const VoiceSpriteDialog: React.FC<VoiceSpriteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  audioDevices,
  onRefreshDevices,
  isLoadingDevices
}) => {
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  useEffect(() => {
    if (isOpen && audioDevices.length > 0) {
      setSelectedDevice(audioDevices[0].deviceId);
    }
  }, [isOpen, audioDevices]);

  const handleConfirm = () => {
    const device = audioDevices.find(d => d.deviceId === selectedDevice);
    if (device) {
      onConfirm(device.deviceId, device.label || `Microphone ${device.deviceId.slice(0, 8)}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🎤 Add Voice Source</h2>
          
          {/* Audio Device Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Microphone
              </label>
              <button
                onClick={onRefreshDevices}
                disabled={isLoadingDevices}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoadingDevices ? '🔄 Loading...' : '🔄 Refresh'}
              </button>
            </div>
            {audioDevices.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-gray-500 mb-2">No microphones found</div>
                <div className="text-sm text-gray-400">
                  Make sure your microphone is connected and permissions are granted
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {audioDevices.map((device) => (
                  <label key={device.deviceId} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="audioDevice"
                      value={device.deviceId}
                      checked={selectedDevice === device.deviceId}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        Device ID: {device.deviceId.slice(0, 16)}...
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Info about voice sources */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start">
              <div className="text-blue-600 mr-2">ℹ️</div>
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Voice Sources</div>
                <div>Voice sources don't appear on the canvas but will be included in recordings. They capture audio from the selected microphone.</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDevice || audioDevices.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
            >
              Add Voice Source
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSpriteDialog;
