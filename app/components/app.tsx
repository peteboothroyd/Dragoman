import * as React from 'react';
import { Button, Drawer, NavigationDrawer } from 'react-md';

import RequestBuilder from '../containers/requestBuilder';
import ResponseViewer from '../components/responseViewer';
import ModalDialog from '../components/modalDialog';
import ServiceList from '../containers/serviceList';
import Settings from '../containers/settings';

const styles = require('./app.scss');

import { AppState } from '../reducers/index';

export type AppComponentProps = AppComponentState & AppComponentMethods;

export interface AppComponentMethods {
    checkRuntimeJavaVersion: () => void;
    closeDialog: () => void;
    openDialog: (title: string, explanation: string, onAccept?: () => void, onCancel?: () => void) => void;
    handleSettingsClick: () => void;
    showNotification: (title: string, body: string) => void;
    clearLogs: () => void;
}

export interface AppComponentState {
    appState: AppState;
}

class App extends React.Component<AppComponentProps> {
    constructor(props: AppComponentProps) {
        super(props);
        this.props.checkRuntimeJavaVersion();
      }

      public render() {
        return (
          <div>
            <NavigationDrawer
              desktopDrawerType='clipped'
              tabletDrawerType='clipped'
              drawerClassName='md-toolbar-relative'
              drawerHeader={
                  <ServiceList
                  showNotification={this.props.showNotification}
                  />}
              toolbarTitle='Dragoman'
              toolbarActions={
                <Button
                  icon={true}
                  onClick={this.props.handleSettingsClick}
                  children='settings'/>}
              children={
                <div className={styles['main-content']}>
                  <RequestBuilder
                    showNotification={this.props.showNotification}
                  />
                  <ResponseViewer
                    responseViewerState={this.props.appState.responseViewerState}
                    fullMethod={this.props.appState.requestBuilderState.fullMethod}
                    clearLogs={this.props.clearLogs}
                  />
                </div>}
            />
            <Drawer
              className='md-toolbar-relative'
              defaultMedia='desktop'
              visible={this.props.appState.appUIState.settingsOpen}
              position='right'
              children={<Settings />}
              onVisibilityChange={() => {/**/}} // Suppress spurious react-md error
              overlay={false}
              clickableDesktopOverlay={true}
            />
            <ModalDialog
              appUIState={this.props.appState.appUIState}
              defaultCloseDialog={this.props.closeDialog}
            />
          </div>
        );
    }
}

export default App;
