import { EduRoleTypeEnum } from 'agora-edu-core/lib/type';
import { Toast } from '../../../components/toast';
import { action, autorun, computed, observable, runInAction } from 'mobx';
import { AgoraPolling } from '.';
import { transI18n, bound } from 'agora-common-libs';
import { AgoraExtensionRoomEvent, AgoraExtensionWidgetEvent } from '../../../events';
import { OrientationEnum } from '../hx-chat/type';

// 2 为老师或者助教出题阶段 只可老师或者助教可见
// 1 为中间答题阶段，不同为老师或者助教和学生的权限问题
// 0 为最后结果展示阶段

type stagePanel = 0 | 1 | 2;

type optionType = 'radio' | 'checkbox';

const maxOptionCount = 5;

export class PluginStore {
  constructor(private _widget: AgoraPolling) {
    autorun(() => {
      const { extra } = _widget.roomProperties;
      typeof extra?.pollState !== 'undefined' && this.setStagePanel(extra.pollState);
      typeof extra?.pollTitle !== 'undefined' && this.setTitle(extra.pollTitle);
      extra?.mode && this.setType(this.getTypeByMode);
      runInAction(() => {
        typeof extra?.pollItems !== 'undefined' && (this.options = extra.pollItems);
      });
    });

    this._widget.addBroadcastListener({
      messageType: AgoraExtensionRoomEvent.MobileLandscapeToolBarVisibleChanged,
      onMessage: this._handleMobileLandscapeToolBarStateChanged,
    });
    this._widget.broadcast(
      AgoraExtensionWidgetEvent.RequestMobileLandscapeToolBarVisible,
      undefined,
    );

    this._widget.addBroadcastListener({
      messageType: AgoraExtensionRoomEvent.OrientationStatesChanged,
      onMessage: this._handleOrientationChanged,
    });
    this._widget.broadcast(AgoraExtensionWidgetEvent.RequestOrientationStates, undefined);
  }

  @observable minimize = true;

  @observable
  stagePanel: stagePanel = 2;

  @observable
  title = ''; // 题干

  @observable
  options: string[] = ['', ''];

  @observable
  selectedOptions: string[] = [];

  @observable
  type: optionType = 'radio';
  @observable orientation: OrientationEnum = OrientationEnum.portrait;
  @observable forceLandscape = false;
  @observable landscapeToolBarVisible = false;

  @computed
  get isLandscape() {
    return this.forceLandscape || this.orientation === OrientationEnum.landscape;
  }

  @action.bound
  private _handleMobileLandscapeToolBarStateChanged(visible: boolean) {
    this.landscapeToolBarVisible = visible;
  }
  @action.bound
  private _handleOrientationChanged(params: {
    orientation: OrientationEnum;
    forceLandscape: boolean;
  }) {
    this.orientation = params.orientation;
    this.forceLandscape = params.forceLandscape;
  }
  @action.bound
  setMinimize(minimize: boolean) {
    this.minimize = minimize;
  }

  @action.bound
  setTitle(title: string) {
    this.title = title;
  }

  @action.bound
  setType(type: optionType) {
    this.type = type;
  }

  @action.bound
  addOption(text = '') {
    this.options = [...this.options, text];
  }
  @action.bound
  reduceOption() {
    this.options.splice(this.options.length - 1, 1);
  }

  @action.bound
  changeOptions(index: number, value: string) {
    this.options[index] = value;
  }

  @action.bound
  handleStartVote() {
    const { x, y } = this._widget.track.ratioVal.ratioPosition;
    const body = {
      mode: this.type === 'radio' ? 1 : 2,
      pollItems: this.options,
      pollTitle: this.title,
      position: { xaxis: x, yaxis: y },
    };

    const roomId = this._widget.classroomStore.connectionStore.sceneId;
    this._widget.classroomStore.api.startPolling(roomId, body);
  }
  @bound
  addSubmitToast() {
    this._widget.broadcast(AgoraExtensionWidgetEvent.AddSingletonToast, {
      desc: transI18n('widget_polling.submit-tip'),
      type: 'normal',
    });
  }

  /**
   * 投票
   */
  @action.bound
  handleSubmitVote(selectedIndexs?: number[]) {
    const { userUuid } = this._widget.classroomConfig.sessionInfo;
    const roomId = this._widget.classroomStore.connectionStore.sceneId;
    const { extra } = this._widget.roomProperties;

    const indexs = selectedIndexs || this.selectedIndexs;
    return new Promise((resolve, reject) => {
      this._widget.classroomStore.api
        .submitResult(roomId, extra.pollId, userUuid, {
          selectIndex: indexs,
        })
        .then((res) => {
          const data = res.data;

          this._widget.updateWidgetUserProperties({
            pollId: data?.pollId,
          });

          resolve(data);
        })
        .catch((e) => {
          Toast.show({
            type: 'error',
            text: JSON.stringify(e),
            closeToast: () => {},
          });
          reject(e);
        });
    });
  }

  /**
   * 结束投票
   */

  @action.bound
  handleStopVote() {
    const { extra } = this._widget.roomProperties;
    const roomId = this._widget.classroomStore.connectionStore.sceneId;
    this._widget.classroomStore.api.stopPolling(roomId, extra.pollId);
  }

  @action.bound
  setStagePanel(state: stagePanel) {
    this.stagePanel = state;
  }

  @action.bound
  hanldeSelectedOptions(e: any) {
    const checked = e.target.checked,
      value = e.target.value;
    if (this.type === 'radio') {
      checked ? (this.selectedOptions[0] = value) : (this.selectedOptions = []);
    } else if (this.type === 'checkbox') {
      this.selectedOptions = checked
        ? [...this.selectedOptions, value]
        : this.selectedOptions.filter((option: string) => option !== value);
    }
  }
  @action.bound
  destroy() {
    this.stagePanel = 2;
    this.title = '';
    this.options = ['', ''];
    this.selectedOptions = [];
    this.type = 'radio';
    this._widget.removeBroadcastListener({
      messageType: AgoraExtensionRoomEvent.OrientationStatesChanged,
      onMessage: this._handleOrientationChanged,
    });
  }

  /**
   * 获取时间差
   */
  @computed
  get getTimestampGap() {
    return this._widget.classroomStore.roomStore.clientServerTimeShift;
  }

  @computed
  get getTypeByMode() {
    let mode = 'radio';
    const { extra } = this._widget.roomProperties;

    if (extra?.mode) {
      mode = extra.mode === 1 ? 'radio' : 'checkbox';
    }
    return mode as optionType;
  }

  @computed
  get isController() {
    const { role } = this._widget.classroomConfig.sessionInfo;
    return role === EduRoleTypeEnum.teacher || role === EduRoleTypeEnum.assistant;
  }

  @computed
  get isTeacherType() {
    return [EduRoleTypeEnum.teacher, EduRoleTypeEnum.assistant, EduRoleTypeEnum.observer].includes(
      this._widget.classroomConfig.sessionInfo.role,
    );
  }

  @computed
  get addBtnCls() {
    return this.options.length >= maxOptionCount ? 'visibility-hidden' : 'visibility-visible';
  }

  @computed
  get reduceBtnCls() {
    return this.options.length > 2 ? 'visibility-visible' : 'visibility-hidden';
  }

  @computed
  get submitDisabled() {
    return (
      !this.title ||
      this.options.some((value: string) => !value) ||
      new Set(this.options).size !== this.options.length
    );
  }

  @computed
  get pollingResult() {
    const { extra } = this._widget.roomProperties;
    return extra?.pollDetails as Record<number, { percentage: number; num: number }>;
  }

  @computed
  get pollingResultUserCount() {
    const { extra } = this._widget.roomProperties;
    return extra.userCount as number;
  }
  @computed
  get selectedIndexs() {
    return this.selectedOptions.map((selectedOption: string) =>
      this.options.findIndex((option) => option === selectedOption),
    );
  }

  @computed
  get isShowResultSection() {
    // 1.当前有控制权限并处于答题阶段
    // 2.已经结束答题
    const { pollId } = this._widget.userProperties;
    const { extra } = this._widget.roomProperties;

    if (this.stagePanel === 1 && this.isController) {
      return true;
    } else if (this.stagePanel === 1 && pollId === extra.pollId) {
      return true;
    } else if (this.stagePanel === 0) {
      return true;
    }
    return false;
  }

  @computed
  get selectedIndexResult() {
    const { selectIndex } = this._widget.userProperties as { selectIndex?: number[] };
    return new Set(selectIndex || []);
  }

  @computed
  get isInitinalStage() {
    return this.stagePanel === 2 && this.isTeacherType;
  }

  /**
   * for students
   */
  @computed
  get isShowVote() {
    return !this.isShowResultSection && this.stagePanel === 1 && !this.isTeacherType;
  }

  @computed
  get isShowVoteBtn() {
    const { sessionInfo } = this._widget.classroomConfig;

    return this.isShowVote && sessionInfo.role !== EduRoleTypeEnum.invisible;
  }

  @computed
  get visibleVote() {
    const { pollId } = this._widget.userProperties;
    return this.isShowVote && pollId;
  }
}
