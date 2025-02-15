import { EduRoomTypeEnum } from 'agora-edu-core/lib/type';
import { action, autorun, observable, runInAction } from 'mobx';
import { AgoraHXChatWidget } from '.';
import { OrientationEnum } from './type';

export class WidgetChatUIStore {
  private _matchMedia = window.matchMedia('(orientation: portrait)');

  @observable
  orientation: OrientationEnum = OrientationEnum.portrait;

  @observable
  isFullSize = false;

  @observable
  showChat = false;

  constructor(private _widget: AgoraHXChatWidget) {
    const { sessionInfo, platform } = _widget.classroomConfig;
    const isH5 = platform === 'H5';
    this.handleOrientationchange();
    autorun(() => {
      let isFullSize = false;
      if (sessionInfo.roomType === EduRoomTypeEnum.RoomBigClass && isH5) {
        isFullSize = true;
      } else if (sessionInfo.roomType === EduRoomTypeEnum.RoomBigClass && isH5) {
        isFullSize = this.orientation === 'portrait' ? false : true;
      } else {
        isFullSize =
          sessionInfo.roomType === EduRoomTypeEnum.RoomBigClass ||
          sessionInfo.roomType === EduRoomTypeEnum.Room1v1Class;
      }
      runInAction(() => (this.isFullSize = isFullSize));
    });

    autorun(() => {
      let isShowChat = isH5 ? true : false;

      if (sessionInfo.roomType === EduRoomTypeEnum.RoomBigClass && isH5) {
        isShowChat = true;
      } else if (sessionInfo.roomType === EduRoomTypeEnum.RoomBigClass && isH5) {
        isShowChat = this.orientation === 'portrait' ? false : true;
      } else if (
        [EduRoomTypeEnum.Room1v1Class, EduRoomTypeEnum.RoomBigClass].includes(sessionInfo.roomType)
      ) {
        isShowChat = true;
      }
      runInAction(() => (this.showChat = isShowChat));
    });
  }

  @action.bound
  handleOrientationchange() {
    // If there are matches, we're in portrait
    if (this._matchMedia.matches) {
      // Portrait orientation
      this.orientation = OrientationEnum.portrait;
    } else {
      // Landscape orientation
      this.orientation = OrientationEnum.landscape;
    }
  }

  addOrientationchange = () => {
    this._matchMedia.addListener(this.handleOrientationchange);
    this.handleOrientationchange();
  };

  removeOrientationchange = () => {
    this._matchMedia.removeListener(this.handleOrientationchange);
  };
}
