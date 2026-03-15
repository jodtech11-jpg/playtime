import React, { useState, useRef, useCallback } from 'react';
import { uploadFile, uploadFileWithProgress } from '../../services/firebase';
import { getDownloadURL } from 'firebase/storage';
import { compressImage, validateImageFile, fileToDataURL, formatFileSize } from '../../utils/imageUtils';
import { useToast } from '../../contexts/ToastContext';

export interface ImageUploadFile {
  file: File;
  preview: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

interface ImageUploadProps {
  value: string[]; // Array of image URLs
  onChange: (urls: string[]) => void;
  folder: string; // Storage folder path (e.g., 'venues', 'products', 'staff')
  itemId?: string; // Item ID for folder structure (e.g., venue ID, product ID)
  maxImages?: number; // Maximum number of images (default: 10)
  maxSizeMB?: number; // Maximum file size in MB (default: 5)
  compress?: boolean; // Whether to compress images (default: true)
  multiple?: boolean; // Allow multiple file selection (default: true)
  disabled?: boolean; // Disable upload
  className?: string; // Additional CSS classes
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value = [],
  onChange,
  folder,
  itemId,
  maxImages = 10,
  maxSizeMB = 5,
  compress = true,
  multiple = true,
  disabled = false,
  className = ''
}) => {
  const { showError, showSuccess } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, ImageUploadFile>>(new Map());
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxImages - value.length;

    if (fileArray.length > remainingSlots) {
      showError(`You can only upload ${remainingSlots} more image${remainingSlots !== 1 ? 's' : ''}`);
      return;
    }

    const newFiles = new Map(uploadingFiles);

    for (const file of fileArray) {
      // Validate file
      const validation = validateImageFile(file, maxSizeMB);
      if (!validation.valid) {
        showError(validation.error || 'Invalid file');
        continue;
      }

      // Create preview
      let preview: string;
      try {
        preview = await fileToDataURL(file);
      } catch (error: any) {
        showError(`Failed to load ${file.name}: ${error.message}`);
        continue;
      }

      const fileId = `${Date.now()}_${file.name}`;
      newFiles.set(fileId, {
        file,
        preview,
        uploading: true,
        progress: 0
      });

      // Upload file
      uploadImage(fileId, file, newFiles);
    }

    setUploadingFiles(newFiles);
  }, [value.length, maxImages, maxSizeMB, uploadingFiles, showError]);

  // Upload image
  const uploadImage = async (
    fileId: string,
    file: File,
    filesMap: Map<string, ImageUploadFile>
  ) => {
    try {
      // Compress if enabled
      let fileToUpload: File | Blob = file;
      if (compress) {
        try {
          fileToUpload = await compressImage(file);
        } catch (error) {
          console.warn('Compression failed, using original file:', error);
          fileToUpload = file;
        }
      }

      // Determine upload path
      const fileName = `${Date.now()}_${file.name}`;
      const uploadPath = itemId
        ? `${folder}/${itemId}/${fileName}`
        : `${folder}/temp/${fileName}`;

      // Upload with progress tracking
      const uploadTask = uploadFileWithProgress(
        uploadPath,
        fileToUpload,
        (progress) => {
          const updatedFile = filesMap.get(fileId);
          if (updatedFile) {
            filesMap.set(fileId, {
              ...updatedFile,
              progress
            });
            setUploadingFiles(new Map(filesMap));
          }
        },
        {
          contentType: file.type || 'image/jpeg',
          customMetadata: {
            originalName: file.name,
            originalSize: file.size.toString()
          }
        }
      );

      // Wait for upload to complete
      await new Promise<void>((resolve, reject) => {
        uploadTask.then(
          async (snapshot) => {
            try {
              const url = await getDownloadURL(snapshot.ref);
              
              // Update file with URL
              const updatedFile = filesMap.get(fileId);
              if (updatedFile) {
                filesMap.set(fileId, {
                  ...updatedFile,
                  url,
                  uploading: false,
                  progress: 100
                });
                setUploadingFiles(new Map(filesMap));

                // Add URL to value array
                onChange([...value, url]);

                // Remove from uploading files after a delay
                setTimeout(() => {
                  filesMap.delete(fileId);
                  setUploadingFiles(new Map(filesMap));
                }, 1000);
              }

              resolve();
            } catch (error) {
              reject(error);
            }
          },
          (error) => {
            reject(error);
          }
        );
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Update file with error
      const updatedFile = filesMap.get(fileId);
      if (updatedFile) {
        filesMap.set(fileId, {
          ...updatedFile,
          uploading: false,
          error: error.message || 'Upload failed'
        });
        setUploadingFiles(new Map(filesMap));
      }

      showError(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [disabled, handleFileSelect]);

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image
  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  // Open file picker
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const remainingSlots = maxImages - value.length;
  const hasUploadingFiles = uploadingFiles.size > 0;

  return (
    <div className={className}>
      {/* Upload Area */}
      {remainingSlots > 0 && (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-primary bg-primary/5'
              : disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-primary hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple={multiple}
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-gray-400">
              cloud_upload
            </span>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? 'Drop images here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {multiple ? `Up to ${remainingSlots} image${remainingSlots !== 1 ? 's' : ''}` : 'Single image'} • Max {maxSizeMB}MB each
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Files */}
      {hasUploadingFiles && (
        <div className="mt-4 space-y-2">
          {Array.from(uploadingFiles.entries()).map(([fileId, uploadFile]) => (
            <div
              key={fileId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={uploadFile.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(uploadFile.file.size)}
                </p>
                {uploadFile.uploading && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadFile.progress || 0}%` }}
                    />
                  </div>
                )}
                {uploadFile.error && (
                  <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Images */}
      {value.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {value.map((url, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EFailed to load%3C/text%3E%3C/svg%3E';
                }}
              />
              <button
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove image"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Max Images Reached */}
      {remainingSlots === 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Maximum {maxImages} image{maxImages !== 1 ? 's' : ''} reached. Remove an image to upload more.
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;

