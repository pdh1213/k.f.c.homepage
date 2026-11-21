import React,{useEffect,useRef,useState} from 'react';
import {readStudioModel} from './studio-model.js';
import {resolveLDrawParts} from './ldraw-parts.js';
import './robot-model-viewer.css';

export default function RobotModelViewer({file,url,modelText,title='로봇 3D 모델'}){
  const host=useRef(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[missing,setMissing]=useState([]);
  useEffect(()=>{
    if(!file&&!url&&!modelText)return;
    const request=new AbortController();
    let disposed=false,cleanup=()=>{};
    setStatus('loading');setError('');setMissing([]);
    (async()=>{
      let text=modelText;
      if(!text){
        const source=file||await fetch(url,{signal:request.signal}).then(response=>{
          if(!response.ok)throw Error('모델 파일을 불러오지 못했습니다.');
          return response.blob();
        });
        text=await readStudioModel(file||new File([source],'robot.io',{type:'application/octet-stream'}));
      }
      const parts=await resolveLDrawParts(text,{signal:request.signal});
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
      let frame=0,model=null,dirty=true;
      const resize=()=>{const width=Math.max(1,root.clientWidth),height=Math.max(1,root.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);dirty=true};
      const observer=new ResizeObserver(resize);observer.observe(root);resize();
      controls.addEventListener('change',()=>{dirty=true});
      const animate=()=>{
        frame=requestAnimationFrame(animate);
        controls.update();
        if(dirty){renderer.render(scene,camera);dirty=false}
      };
      animate();
      cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();if(model){model.traverse(object=>{object.geometry?.dispose();if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose?.()}})}renderer.dispose();renderer.domElement.remove()};
      const loader=new LDrawLoader();loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      await loader.preloadMaterials('/LDConfig.ldr');
      if(disposed)return;
      loader.parse(parts.text,group=>{
        if(disposed)return;
        model=group;group.rotation.x=Math.PI;scene.add(group);
        const bounds=new THREE.Box3().setFromObject(group);
        if(bounds.isEmpty())throw Error('표시할 수 있는 부품이 없습니다.');
        const center=bounds.getCenter(new THREE.Vector3());
        const direction=(modelText ? new THREE.Vector3(0.16,1.8,1) : new THREE.Vector3(1,0.78,1)).normalize();
        const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
        const up=new THREE.Vector3().crossVectors(direction,right);
        const verticalSlope=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*.84;
        const horizontalSlope=verticalSlope*camera.aspect;
        let distance=80;
        for(const x of [bounds.min.x,bounds.max.x]){
          for(const y of [bounds.min.y,bounds.max.y]){
            for(const z of [bounds.min.z,bounds.max.z]){
              const corner=new THREE.Vector3(x,y,z).sub(center);
              const projection=Math.max(Math.abs(corner.dot(right))/horizontalSlope,Math.abs(corner.dot(up))/verticalSlope);
              distance=Math.max(distance,corner.dot(direction)+projection);
            }
          }
        }
        controls.target.copy(center);
        camera.position.copy(direction.multiplyScalar(distance).add(center));
        camera.near=Math.max(.1,distance/1000);camera.far=Math.max(10000,distance*10);
        camera.updateProjectionMatrix();camera.lookAt(center);controls.update();
        dirty=true;
        setMissing(parts.missing);setStatus('ready');
      },problem=>{if(!disposed){setStatus('error');setError(problem?.message||'이 모델의 일부 부품을 표시할 수 없습니다.')}});
    })().catch(problem=>{if(!disposed){setStatus('error');setError(problem?.message||'3D 모델을 열지 못했습니다.')}});
    return()=>{disposed=true;request.abort();cleanup()};
  },[file,url,modelText]);
  if(!file&&!url&&!modelText)return null;
  return <section className="robot-model-viewer" aria-label={title}>
    <div className="robot-model-head"><strong>{title}</strong><small>드래그하여 회전 · 스크롤하여 확대</small></div>
    <div className="robot-model-canvas" ref={host}/>
    {status==='loading'&&<div className="robot-model-state" role="status">3D 모델과 부품을 불러오는 중…</div>}
    {status==='error'&&<p className="robot-model-error" role="alert">{error}</p>}
    {status==='ready'&&missing.length>0&&<details className="robot-model-error">
      <summary>부품 또는 세부 형상 {missing.length}종을 불러오지 못했습니다.</summary>
      <p>{missing.slice(0,18).join(', ')}{missing.length>18?' 외 '+(missing.length-18)+'종':''}</p>
    </details>}
    <small className="robot-model-credit">부품 데이터: <a href="https://www.ldraw.org/" target="_blank" rel="noopener noreferrer">LDraw Parts Library</a></small>
  </section>;
}

