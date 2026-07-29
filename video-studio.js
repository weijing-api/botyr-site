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
          <h3>2. 自动讲解与声音</h3>
          <p>让 AI 使用当前完整口播生成普通话讲解，也可以改用自己的录音。</p>
          <div class="studio-voice-row">
            <select id="studio-voice" aria-label="选择AI音色">
              <option value="101001">自然女声</option>
              <option value="101004">沉稳男声</option>
              <option value="101030">通用男声</option>
            </select>
            <button id="studio-generate-voice" type="button">生成 AI 讲解</button>
          </div>
          <p class="studio-voice-status" id="studio-voice-status">尚未生成 AI 讲解</p>
          <audio id="studio-voice-preview" controls hidden></audio>
          <label class="studio-file">添加音频 <span>MP3 / M4A / WAV</span><input id="studio-audio" type="file" accept="audio/*" /></label>
          <p class="studio-audio-name" id="studio-audio-name">暂未添加音频</p>
          <label class="studio-music-toggle"><input id="studio-auto-music" type="checkbox" checked /><span><b>自动添加轻音乐</b><small>系统生成低音量氛围音乐，并自动避让讲解</small></span></label>
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
  const voiceSelect = section.querySelector('#studio-voice');
  const voiceButton = section.querySelector('#studio-generate-voice');
  const voiceStatus = section.querySelector('#studio-voice-status');
  const voicePreview = section.querySelector('#studio-voice-preview');
  const autoMusic = section.querySelector('#studio-auto-music');
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
  let generatedVoiceBlob = null;
  let generatedVoiceUrl = '';

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
  const base64ToBlob = (base64, type) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type });
  };
  const waitForMedia = media => withTimeout(new Promise((resolve, reject) => {
    if (Number.isFinite(media.duration) && media.duration > 0) return resolve();
    media.addEventListener('loadedmetadata', resolve, { once: true });
    media.addEventListener('error', () => reject(new Error('音频读取失败')), { once: true });
    media.load();
  }), 10000, '音频读取超时，请更换音频');
  const createMusicBed = (context, destination, duration, hasNarration) => {
    const master = context.createGain();
    master.gain.setValueAtTime(hasNarration ? 0.022 : 0.045, context.currentTime);
    master.connect(destination);
    const oscillators = [0, 1, 2].map(index => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      gain.gain.value = index === 0 ? .55 : .3;
      oscillator.connect(gain).connect(master);
      return oscillator;
    });
    const chords = [
      [220, 277.18, 329.63],
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [196, 246.94, 329.63],
    ];
    const startAt = context.currentTime + .05;
    for (let time = 0, chord = 0; time < duration; time += 3.2, chord += 1) {
      chords[chord % chords.length].forEach((frequency, index) => {
        oscillators[index].frequency.setTargetAtTime(frequency, startAt + time, .35);
      });
    }
    master.gain.setValueAtTime(hasNarration ? .022 : .045, startAt);
    master.gain.setTargetAtTime(0.0001, startAt + Math.max(0, duration - 1.2), .35);
    oscillators.forEach(oscillator => {
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + .2);
    });
    return oscillators;
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
    generatedVoiceBlob = null;
    if (generatedVoiceUrl) URL.revokeObjectURL(generatedVoiceUrl);
    generatedVoiceUrl = '';
    voicePreview.hidden = true;
    voicePreview.removeAttribute('src');
    voiceStatus.textContent = audioInput.files[0] ? '已改用你上传的音频' : '尚未生成 AI 讲解';
    audioName.textContent = audioInput.files[0]?.name || '暂未添加音频';
    resetOutput();
    globalThis.BotyrAnalytics?.track('video_media_added', { media_type: 'audio', count: audioInput.files.length });
  });
  voiceButton.addEventListener('click', async () => {
    const text = resultCopy().script.slice(0, 150);
    if (!text) {
      voiceStatus.textContent = '当前方案没有可用口播';
      return;
    }
    voiceButton.disabled = true;
    voiceButton.textContent = '正在生成…';
    voiceStatus.textContent = 'AI 正在生成普通话讲解…';
    try {
      const response = await fetch('https://botyr-ai-api.3246809585.workers.dev/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceType: Number(voiceSelect.value) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.audio) throw new Error(payload.error || 'AI 讲解生成失败');
      generatedVoiceBlob = base64ToBlob(payload.audio, 'audio/mpeg');
      if (generatedVoiceUrl) URL.revokeObjectURL(generatedVoiceUrl);
      generatedVoiceUrl = URL.createObjectURL(generatedVoiceBlob);
      voicePreview.src = generatedVoiceUrl;
      voicePreview.hidden = false;
      voiceStatus.textContent = 'AI 讲解已生成，可以试听';
      audioInput.value = '';
      audioName.textContent = '当前使用 AI 自动讲解';
      resetOutput();
      globalThis.BotyrAnalytics?.track('ai_narration_success', { voice_type: Number(voiceSelect.value), text_length: text.length });
    } catch (error) {
      voiceStatus.textContent = error.message || 'AI 讲解生成失败';
    } finally {
      voiceButton.disabled = false;
      voiceButton.textContent = '重新生成 AI 讲解';
    }
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
    const narrationBlob = generatedVoiceBlob || audioInput.files[0] || null;
    const useMusic = Boolean(autoMusic?.checked);
    globalThis.BotyrAnalytics?.track('local_video_render_start', { image_count: imageFiles.length, has_audio: Boolean(narrationBlob), auto_music: useMusic });
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
      const baseDuration = Math.max(8.4, Math.min(16.8, bitmaps.length * 2.8));
      let duration = baseDuration;
      const fps = 30;
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = 720;
      renderCanvas.height = 1280;
      const renderContext = renderCanvas.getContext('2d');
      const videoStream = renderCanvas.captureStream(fps);
      tracks = [...videoStream.getVideoTracks()];
      let destination = null;
      if (narrationBlob || useMusic) {
        audioContext = new AudioContext();
        destination = audioContext.createMediaStreamDestination();
        tracks.push(...destination.stream.getAudioTracks());
      }
      if (narrationBlob) {
        audioUrl = URL.createObjectURL(narrationBlob);
        audioElement = new Audio(audioUrl);
        await waitForMedia(audioElement);
        duration = Math.max(baseDuration, Math.min(45, audioElement.duration + .5));
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(destination);
      }
      if (useMusic) createMusicBed(audioContext, destination, duration, Boolean(narrationBlob));
      const sceneSeconds = duration / bitmaps.length;
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
      if (audioContext) {
        progressText.textContent = '正在启动自动声音…';
        await withTimeout(
          audioContext.resume(),
          4000,
          '浏览器阻止了自动声音，请点击页面后重试',
        );
      }
      if (audioElement) {
        await withTimeout(
          audioElement.play(),
          5000,
          '浏览器阻止了讲解播放，请点击页面后重试',
        );
      }
      const startedAt = performance.now();
      await withTimeout(new Promise(resolve => {
        const tick = () => {
          const now = performance.now();
          const elapsed = (now - startedAt) / 1000;
          const ratio = Math.min(1, elapsed / duration);
          const scene = Math.min(bitmaps.length - 1, Math.floor(elapsed / sceneSeconds));
          const sceneProgress = (elapsed % sceneSeconds) / sceneSeconds;
          const sentence = sentences[Math.min(sentences.length - 1, Math.floor(ratio * sentences.length))];
          drawFrame(renderContext, bitmaps[scene], copy, sentence, sceneProgress, section.querySelector('[name="studio-style"]:checked')?.value);
          progress.style.width = `${Math.round(ratio * 100)}%`;
          progressText.textContent = ratio < .33 ? '正在编排画面…' : ratio < .72 ? '正在生成字幕和转场…' : ratio < 1 ? '正在封装视频…' : '合成完成';
          if (ratio < 1) setTimeout(tick, 1000 / fps);
          else resolve();
        };
        tick();
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
      globalThis.BotyrAnalytics?.track('local_video_render_success', { image_count: imageFiles.length, has_audio: Boolean(narrationBlob), auto_music: useMusic, duration_seconds: duration });
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
