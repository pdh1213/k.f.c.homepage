const {autoUpdater}=require('electron-updater');
function startAutoUpdates({app,dialog,getWindow}){
  let busy=false,downloaded=false,manual=false,checkingError=false,available=false;
  const message=options=>{
    const parent=getWindow();
    return parent&&!parent.isDestroyed()?dialog.showMessageBox(parent,options):dialog.showMessageBox(options);
  };
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowDowngrade=false;
  autoUpdater.on('update-available',()=>{busy=true;available=true;});
  autoUpdater.on('update-not-available',()=>{
    available=false;
    if(manual)message({type:'info',title:'K.F.C. 업데이트',message:'최신 버전을 사용 중입니다.'});
    manual=false;
  });
  autoUpdater.on('error',()=>{
    busy=false;available=false;
    if(manual&&!checkingError){checkingError=true;message({type:'warning',title:'업데이트 확인',message:'업데이트 서버에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.'}).finally(()=>{checkingError=false;});}
    manual=false;
  });
  autoUpdater.on('update-downloaded',async()=>{
    busy=false;downloaded=true;manual=false;
    const result=await message({type:'info',title:'K.F.C. 업데이트',message:'새 버전이 준비되었습니다.',detail:'작업을 마치고 다시 시작하면 적용됩니다. 나중에 설치를 선택하면 앱을 종료할 때 설치합니다.',buttons:['지금 다시 시작','나중에 설치'],defaultId:1,cancelId:1});
    if(result.response===0)autoUpdater.quitAndInstall(false,true);
  });
  async function check(userRequested=false){
    if(!app.isPackaged||process.platform!=='win32'){
      if(userRequested)await message({type:'info',message:'자동 업데이트는 설치된 Windows 앱에서 사용할 수 있습니다.'});
      return;
    }
    if(downloaded){if(userRequested)autoUpdater.quitAndInstall(false,true);return;}
    if(busy){if(userRequested)await message({type:'info',message:'업데이트를 확인하거나 내려받고 있습니다. 준비가 끝나면 알려드릴게요.'});return;}
    busy=true;manual=userRequested;
    try{await autoUpdater.checkForUpdates();}
    catch{/* error 이벤트에서 안내하며 다음 확인 때 재시도합니다. */}
    finally{if(!available)busy=false;}
  }
  const first=setTimeout(()=>check(),12000);
  const timer=setInterval(()=>check(),6*60*60*1000);
  first.unref?.();timer.unref?.();
  app.once('before-quit',()=>{clearTimeout(first);clearInterval(timer);});
  return {check};
}
module.exports={startAutoUpdates};
