import React,{useEffect,useRef,useState} from 'react';
import {readStudioModel} from './studio-model.js';
import './robot-model-viewer.css';

export default function RobotModelViewer({file,url,title='로봇 3D 모델'}){
  const host=useRef(null),[status,setStatus]=useState('loading'),[error,setError]=useState('');
  useEffect(()=>{
    if(!file&&!url)return;
    let disposed=false,cleanup=()=>{};
    setStatus('loading');setError('');
    (async()=>{
      const source=file||await fetch(url).then(response=>{if(!response.ok)throw Error('모델 파일을 불러오지 못했습니다.');return response.blob()});
      if(disposed)return;
      const studioFile=file||new File([source],'robot.io',{type:'application/octet-stream'});
      const modelText=await readStudioModel(studioFile);
      if(disposed)return;
      const THREE=await import('three');
      const [{LDrawLoader},{OrbitControls},{LDrawConditionalLineMaterial}]=await Promise.all([import('three/addons/loaders/LDrawLoader.js'),import('three/addons/controls/OrbitControls.js'),import('three/addons/materials/LDrawConditionalLineMaterial.js')]);
      if(disposed)return;
      const root=host.current;if(!root)return;
      const scene=new THREE.Scene();scene.background=new THREE.Color('#f2f4f7');
      const camera=new THREE.PerspectiveCamera(40,1,0.1,100000);
      const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
      root.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight(0xffffff,2));
      const light=new THREE.DirectionalLight(0xffffff,2.6);light.position.set(200,300,250);scene.add(light);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
      let frame=0,model=null;
      const resize=()=>{const width=Math.max(1,root.clientWidth),height=Math.max(1,root.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)};
      const observer=new ResizeObserver(resize);observer.observe(root);resize();
      const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)};animate();
      cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();if(model){model.traverse(object=>{object.geometry?.dispose();if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose?.()}})}renderer.dispose();renderer.domElement.remove()};
      const loader=new LDrawLoader();loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      loader.setPartsLibraryPath('https://cdn.jsdelivr.net/gh/kulits/ldraw-parts@c70360d1c588be894997b2168c61909bc8058c4d/ldraw/');
      await loader.preloadMaterials('/LDConfig.ldr');
      if(disposed)return;
      loader.parse(modelText,group=>{
        if(disposed)return;
        model=group;group.rotation.x=Math.PI;scene.add(group);
        const bounds=new THREE.Box3().setFromObject(group);
        if(bounds.isEmpty())return setError('표시할 수 있는 부품이 없습니다.');
        const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
        controls.target.copy(center);const distance=Math.max(size.length()*.8,80);camera.position.set(center.x+distance,center.y+distance*.7,center.z+distance);camera.near=Math.max(.1,distance/1000);camera.far=Math.max(10000,distance*10);camera.updateProjectionMatrix();camera.lookAt(center);controls.update();setStatus('ready');
      },problem=>{if(!disposed){setStatus('error');setError(problem?.message||'이 모델의 일부 부품을 표시할 수 없습니다.')}});
    })().catch(problem=>{if(!disposed){setStatus('error');setError(problem?.message||'3D 모델을 열지 못했습니다.')}});
    return()=>{disposed=true;cleanup()};
  },[file,url]);
  if(!file&&!url)return null;
  return <section className="robot-model-viewer" aria-label={title}><div className="robot-model-head"><strong>{title}</strong><small>드래그하여 회전 · 스크롤하여 확대</small></div><div className="robot-model-canvas" ref={host}/>{status==='loading'&&<div className="robot-model-state" role="status">3D 모델을 준비하고 있어요…</div>}{status==='error'&&<p className="robot-model-error" role="alert">{error}</p>}<small className="robot-model-credit">부품 데이터: <a href="https://www.ldraw.org/" target="_blank" rel="noopener noreferrer">LDraw Parts Library</a></small></section>;
}

