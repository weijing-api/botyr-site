(() => {
  const result = document.querySelector('#result');
  const actions = document.querySelector('.result-actions');
  if (!result || !actions) return;

  const section = document.createElement('section');
  section.className = 'video-studio';
  section.id = 'video-studio';
  section.hidden = true;
  section.innerHTML = `
    <div class="studio-heading">
      <button class="studio-close" type="button" aria-label="关闭成片制作台">×</button>
      <div>
        <p class="studio-kicker">照片成片工作台</p>
        <h2>把刚才的方案，做成竖屏视频</h2>
        <p>上传门店或产品照片，可选配音/音乐。字幕、轻微推拉和转场由浏览器在本地合成，素材不会上传服务器。</p>
      </div>
      <span class="studio-beta">BETA</span>
    </div>
    <div class="studio-grid">
      <div class="studio-controls">
        <div class="studio-block">
          <h3>1. 上传画面</h3>
          <p>建议按拍摄顺序选择 3–6 张竖图，第一张会作为开场画面。</p>
          <label class="studio-file">选择产品或门店照片 <span>最多 6 张</span><input id="studio-images" type="file" accept="image/*" multiple /></label>
          <div class="studio-thumbs" id="studio-thumbs"><span class="studio-empty">还没有选择照片</span></div>
        </div>
        <div class="studio-block">
          <h3>2. 可选声音</h3>
          <p>可以上传自己录制的口播或一段有使用授权的音乐；不上传也能生成无声字幕版。</p>
          <label class="studio-file">添加音频 <span>MP3 / M4A / WAV</span><input id="studio-audio" type="file" accept="audio/*" /></label>
          <p class="studio-audio-name" id="studio-audio-name">暂未添加音频</p>
        </div>
        <div class="studio-block">
          <h3>3. 视频样式</h3>
          <div class="studio-format">
            <label><input type="radio" name="studio-style" value="clean" checked /> 商家专业字幕</label>
            <label><input type="radio" name="studio-style" value="pink" /> 品牌粉色字幕</label>
          </div>
        </div>
        <div class="studio-note">第一版导出 WebM 竖屏视频。请只使用自己拍摄或已获授权的图片和音频；云端 MP4、AI 配音和视频片段剪辑将在下一阶段接入。</div>
        <button class="studio-render" id="studio-render" type="button">生成可下载视频</button>
        <div><div class="studio-progress"><i id="studio-progress"></i></div><p class="studio-progress-text" id="studio-progress-text">等待添加素材</p></div>
      </div>
      <aside class="studio-preview">
        <canvas id="studio-canvas" width="360" height="640" aria-label="竖屏视频预览"></canvas>
        <video id="studio-video" controls playsinline hidden></video>
        <div class="studio-preview-label"><span>9:16 竖屏预览</span><span>本地处理</span></div>
        <a class="studio-download" id="studio-download" download="爆单短视频.webm">下载视频</a>
      </aside>
    </div>`;
  result.after(section);

  const entry = document.createElement('button');
  entry.className = 'video-studio-entry';
  entry.type = 'button';
  entry.textContent = '用这份方案生成视频';
  result.insertBefore(entry, actions);

  const imageInput = section.querySelector('#studio-images');
  const audioInput = section.querySelector('#studio-audio');
  const thumbs = section.querySelector('#studio-thumbs');
  const audioName = section.querySelector('#studio-audio-name');
  const renderButton = section.querySelector('#studio-render');
  const canvas = section.querySelector('#studio-canvas');
  const video = section.querySelector('#studio-video');
  const download = section.querySelector('#studio-download');
  const progress = section.querySelector('#studio-progress');
  const progressText = section.querySelector('#studio-progress-text');
  const closeButton = section.querySelector('.studio-close');
  const ctx = canvas.getContext('2d');
  let imageFiles = [];
  let previewBitmaps = [];
  let outputUrl = '';

  const activeIdea = () => document.querySelector('.direction-panel.active .idea-item') || document.querySelector('.idea-item');
  const resultCopy = () => {
    const idea = activeIdea();
    const title = idea?.querySelector('h3')?.textContent?.trim() || document.querySelector('#result-title')?.textContent?.trim() || '本周爆款选题';
    const script = idea?.querySelector('.script-copy')?.textContent?.trim() || idea?.textContent?.trim() || '欢迎了解我们的产品和服务';
    return { title, script: script.replace(/\s+/g, ' ') };
  };
  const splitCopy = text => {
    const parts = text.split(/[。！？!?；;]/).map(item => item.trim()).filter(Boolean);
    return parts.length ? parts.slice(0, 8) : [text];
  };
  const wrapText = (context, text, maxWidth) => {
    const lines = [];
    let line = '';
    for (const char of text) {
      const next = line + char;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const roundedRect = (context, x, y, width, height, radius) => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  };
  const drawCover = (context, image, width, height, zoom = 1, drift = 0) => {
    const scale = Math.max(width / image.width, height / image.height) * zoom;
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sx = Math.max(0, Math.min(image.width - sourceWidth, (image.width - sourceWidth) / 2 + drift * (image.width - sourceWidth) * .22));
    const sy = Math.max(0, (image.height - sourceHeight) / 2);
    context.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, width, height);
  };
  const drawFrame = (context, image, copy, sentence, t = 0, style = 'clean') => {
    const width = context.canvas.width;
    const height = context.canvas.height;
    context.clearRect(0, 0, width, height);
    if (image) drawCover(context, image, width, height, 1.02 + t * .035, t - .5);
    else {
      const fallback = context.createLinearGradient(0, 0, width, height);
      fallback.addColorStop(0, '#273b72');
      fallback.addColorStop(1, '#cf7ba9');
      context.fillStyle = fallback;
      context.fillRect(0, 0, width, height);
    }
    const shade = context.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, 'rgba(10,12,24,.22)');
    shade.addColorStop(.52, 'rgba(10,12,24,.08)');
    shade.addColorStop(1, 'rgba(10,12,24,.78)');
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);

    context.fillStyle = style === 'pink' ? '#ff7db5' : '#fff';
    context.font = '800 30px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
    const titleLines = wrapText(context, copy.title, width - 64).slice(0, 3);
    titleLines.forEach((line, index) => context.fillText(line, 32, 68 + index * 38));

    context.fillStyle = style === 'pink' ? 'rgba(255,111,174,.94)' : 'rgba(18,18,24,.78)';
    roundedRect(context, 26, height - 178, width - 52, 118, 18);
    context.fillStyle = '#fff';
    context.font = '700 23px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
    const captionLines = wrapText(context, sentence, width - 92).slice(0, 3);
    captionLines.forEach((line, index) => context.fillText(line, 46, height - 132 + index * 31));
    context.fillStyle = 'rgba(255,255,255,.78)';
    context.font = '600 13px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif';
    context.fillText('爆单短视频 · AI 内容方案', 32, height - 28);
  };
  const resetOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    canvas.hidden = false;
    download.classList.remove('ready');
  };
  const withTimeout = (promise, milliseconds, message) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)),
  ]);
  const loadBitmaps = async files => withTimeout(
    Promise.all(files.map(file => createImageBitmap(file, {
      resizeWidth: 1280,
      resizeQuality: 'high',
    }))),
    15000,
    '照片读取超时，请减少照片数量或换用 JPG、PNG 格式',
  );
  const refreshPreview = async () => {
    previewBitmaps.forEach(bitmap => bitmap.close?.());
    previewBitmaps = await loadBitmaps(imageFiles);
    const copy = resultCopy();
    drawFrame(ctx, previewBitmaps[0], copy, splitCopy(copy.script)[0], .15, section.querySelector('[name="studio-style"]:checked')?.value);
  };
  const renderThumbs = () => {
    thumbs.innerHTML = '';
    if (!imageFiles.length) {
      thumbs.innerHTML = '<span class="studio-empty">还没有选择照片</span>';
      return;
    }
    imageFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'studio-thumb';
      const img = document.createElement('img');
      img.alt = `素材 ${index + 1}`;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.ariaLabel = `删除素材 ${index + 1}`;
      remove.textContent = '×';
      remove.addEventListener('click', async () => {
        imageFiles.splice(index, 1);
        resetOutput();
        renderThumbs();
        await refreshPreview();
      });
      item.append(img, remove);
      thumbs.append(item);
    });
  };

  entry.addEventListener('click', () => {
    section.hidden = false;
    document.body.classList.add('has-video-studio');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (imageFiles.length && !previewBitmaps.length) {
      refreshPreview().catch(error => {
        progressText.textContent = error.message;
      });
    }
    globalThis.BotyrAnalytics?.track('video_studio_open');
  });
  closeButton.addEventListener('click', () => {
    section.hidden = true;
    document.body.classList.remove('has-video-studio');
    result.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
  imageInput.addEventListener('change', async () => {
    imageFiles = [...imageInput.files].filter(file => file.type.startsWith('image/')).slice(0, 6);
    resetOutput();
    renderThumbs();
    progress.style.width = imageFiles.length ? '3%' : '0';
    progressText.textContent = imageFiles.length ? '正在读取照片…' : '等待添加素材';
    try {
      await refreshPreview();
      progress.style.width = '0';
      progressText.textContent = imageFiles.length ? `已添加 ${imageFiles.length} 张照片，可以生成` : '等待添加素材';
    } catch (error) {
      previewBitmaps = [];
      progress.style.width = '0';
      progressText.textContent = `照片读取失败：${error.message || '请换用 JPG、PNG 或 WebP 图片'}`;
    }
    globalThis.BotyrAnalytics?.track('video_media_added', { media_type: 'image', count: imageFiles.length });
  });
  audioInput.addEventListener('change', () => {
    audioName.textContent = audioInput.files[0]?.name || '暂未添加音频';
    resetOutput();
    globalThis.BotyrAnalytics?.track('video_media_added', { media_type: 'audio', count: audioInput.files.length });
  });
  section.addEventListener('change', event => {
    if (event.target.matches('[name="studio-style"]')) refreshPreview();
  });
  download.addEventListener('click', () => globalThis.BotyrAnalytics?.track('local_video_download'));

  renderButton.addEventListener('click', async () => {
    if (!imageFiles.length) {
      progressText.textContent = '请先选择至少 1 张产品或门店照片';
      imageInput.click();
      return;
    }
    if (!window.MediaRecorder || !canvas.captureStream) {
      progressText.textContent = '当前浏览器不支持本地视频合成，请使用最新版 Chrome 或 Edge';
      return;
    }
    resetOutput();
    renderButton.disabled = true;
    renderButton.textContent = '正在本地合成…';
    progress.style.width = '4%';
    progressText.textContent = '正在准备照片…';
    globalThis.BotyrAnalytics?.track('local_video_render_start', { image_count: imageFiles.length, has_audio: Boolean(audioInput.files[0]) });
    let recorder = null;
    let tracks = [];
    let audioElement = null;
    let audioContext = null;
    let audioUrl = '';
    try {
      if (previewBitmaps.length !== imageFiles.length) previewBitmaps = await loadBitmaps(imageFiles);
      const bitmaps = previewBitmaps;
      if (!bitmaps.length) throw new Error('没有可用照片，请重新选择素材');
      const copy = resultCopy();
      const sentences = splitCopy(copy.script);
      const sceneSeconds = 2.8;
      const duration = Math.max(8.4, Math.min(16.8, bitmaps.length * sceneSeconds));
      const fps = 30;
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = 720;
      renderCanvas.height = 1280;
      const renderContext = renderCanvas.getContext('2d');
      const videoStream = renderCanvas.captureStream(fps);
      tracks = [...videoStream.getVideoTracks()];
      if (audioInput.files[0]) {
        audioUrl = URL.createObjectURL(audioInput.files[0]);
        audioElement = new Audio(audioUrl);
        audioElement.crossOrigin = 'anonymous';
        audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audioElement);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        tracks.push(...destination.stream.getAudioTracks());
      }
      const stream = new MediaStream(tracks);
      const mimeTypes = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(recorder.error || new Error('视频合成失败'));
      });
      recorder.start(500);
      if (audioElement) {
        await audioContext.resume();
        await audioElement.play();
      }
      const startedAt = performance.now();
      await withTimeout(new Promise(resolve => {
        const tick = now => {
          const elapsed = (now - startedAt) / 1000;
          const ratio = Math.min(1, elapsed / duration);
          const scene = Math.min(bitmaps.length - 1, Math.floor(elapsed / sceneSeconds));
          const sceneProgress = (elapsed % sceneSeconds) / sceneSeconds;
          const sentence = sentences[Math.min(sentences.length - 1, Math.floor(ratio * sentences.length))];
          drawFrame(renderContext, bitmaps[scene], copy, sentence, sceneProgress, section.querySelector('[name="studio-style"]:checked')?.value);
          progress.style.width = `${Math.round(ratio * 100)}%`;
          progressText.textContent = ratio < .33 ? '正在编排画面…' : ratio < .72 ? '正在生成字幕和转场…' : ratio < 1 ? '正在封装视频…' : '合成完成';
          if (ratio < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      }), duration * 1000 + 8000, '视频渲染超时，请保持页面显示并减少照片数量');
      recorder.stop();
      audioElement?.pause();
      await finished;
      tracks.forEach(track => track.stop());
      await audioContext?.close();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      outputUrl = URL.createObjectURL(blob);
      video.src = outputUrl;
      video.hidden = false;
      canvas.hidden = true;
      download.href = outputUrl;
      download.classList.add('ready');
      download.textContent = `下载视频（${(blob.size / 1024 / 1024).toFixed(1)} MB）`;
      progress.style.width = '100%';
      progressText.textContent = '已生成，可先播放预览再下载';
      globalThis.BotyrAnalytics?.track('local_video_render_success', { image_count: imageFiles.length, has_audio: Boolean(audioInput.files[0]), duration_seconds: duration });
    } catch (error) {
      console.error(error);
      progressText.textContent = `合成失败：${error.message || '请重新尝试'}`;
      progress.style.width = '0';
    } finally {
      audioElement?.pause();
      if (recorder?.state === 'recording') recorder.stop();
      tracks.forEach(track => track.stop());
      if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      renderButton.disabled = false;
      renderButton.textContent = '重新生成视频';
    }
  });

  drawFrame(ctx, null, { title: '生成方案后，在这里制作视频' }, '上传照片即可开始', 0, 'clean');
})();
