import * as React from "react";
import {
  View,
  PanResponder,
  Animated,
  LayoutChangeEvent,
  PanResponderInstance
} from "react-native";
import { Context } from "create-react-context";

import {
  DraggableProps,
  DraggableInnerProps,
  DNDContext,
  DndId,
  Draggable
} from "./types";

type DraggableState = {
  pan: Animated.ValueXY;
};

export function draggable(
  Consumer: Context<DNDContext>["Consumer"]
): React.ForwardRefExoticComponent<DraggableProps> {
  const noop = () => {}
  class BaseDraggable extends React.Component<
    DraggableInnerProps,
    DraggableState
  > {
    private element?: View;
    private identifier: DndId;
    private moveEvent: (...args: any[]) => void;
    private panResponder: PanResponderInstance;

    static defaultProps = {
      bounceBack: true,
      onPress: noop,
      scale: 1.1, // Max scale of animation
      moveSlop: 15, // Slop area for press
      delay: 40 // Animation delay in miliseconds
    };

    constructor(props: DraggableInnerProps) {
      super(props);

      this.identifier = props.customId || Symbol("draggable");

      this.state = {
        pan: new Animated.ValueXY(),
        canMove: false,
        onStart: true,
        onPress: false,
        scale: new Animated.Value(1),
        moveSlop: 15, // Slop area for press
        delay: 40,
      };

      this.moveEvent = Animated.event([
        null,
        {
          dx: this.state.pan.x,
          dy: this.state.pan.y
        }
      ]);

      this.panResponder = PanResponder.create({
        onPanResponderGrant: (e, gestureState) => {
          this.setState({onPress: true});
          this.onLongPressTimeout = setTimeout(() => {
            this.setState({canMove: true});
            Animated.timing(
              this.state.scale,
              {
                toValue: 1.1,
                friction: 1,
                duration: 300
              }
            ).start(() => {
              Animated.timing(
                this.state.scale,
                {
                  toValue: 0.7,
                  friction: 1,
                  duration: 300
                }
              ).start(() => {
                Animated.timing(
                  this.state.scale,
                  {
                    toValue: 0.9,
                    friction: 1,
                    duration: 300
                  }
                ).start()
              })
            })

          }, 1200);
        },
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => false,
        onShouldBlockNativeResponder: () => false,
        onPanResponderMove: (e, gesture) => {
          if(this.state.canMove) {
            const { pageX, pageY } = e.nativeEvent;
            if(this.state.onStart) {

              this.props.__dndContext.handleDragStart(this.identifier, {
                x: pageX,
                y: pageY
              });
              this.setState({onStart: false});
            }

            this.props.__dndContext.handleDragMove(this.identifier, {
                x: pageX,
                y: pageY
            });

            this.moveEvent(e, gesture);

          }
        },
        onPanResponderStart: e => {

          //if(this.state.canMove) {
            const { pageX, pageY } = e.nativeEvent;
            // this.props.__dndContext.handleDragStart(this.identifier, {
            //     x: pageX,
            //     y: pageY
            // });
          //}
        },
        onPanResponderRelease: (e, gestureState) => {
            clearTimeout(this.onLongPressTimeout);
            this.setState({canMove: false, onStart: true, onPress: false});
            const { pageX, pageY } = e.nativeEvent;
            if (this.props.bounceBack) {
                Animated.spring(this.state.pan, {
                    toValue: { x: 0, y: 0 }
                }).start();
            }
            this.props.__dndContext.handleDragEnd(this.identifier, {
                x: pageX,
                y: pageY
            });
            const { moveSlop, delay, onPress } = this.props

            const isOutOfRange = gestureState.dy > moveSlop || gestureState.dy < (-moveSlop) || gestureState.dx > moveSlop || gestureState.dx < (-moveSlop)

            if (!isOutOfRange) {
              setTimeout(() => {
                Animated.spring(
                  this.state.scale,
                  {
                    toValue: 1,
                    friction: 1,
                    duration: 200
                  }
                ).start()

                //onPress(e)
              }, delay)
            }
        },
        onPanResponderTerminate: () => {
          clearTimeout(this.onLongPressTimeout);
          this.setState({onPress: false});
        },
      });
    }

    componentDidMount() {
      this.props.__dndContext.registerDraggable(this.identifier, {
        onDragStart: this.props.onDragStart,
        onDragEnd: this.props.onDragEnd,
        payload: this.props.payload
      });
    }

    componentWillUnmount() {
      this.props.__dndContext.unregisterDraggable(this.identifier);
    }

    componentDidUpdate(prevProps: DraggableInnerProps) {
      const updatedDraggable: Partial<Draggable> = {};

      if (prevProps.onDragEnd !== this.props.onDragEnd) {
        updatedDraggable.onDragEnd = this.props.onDragEnd;
      }
      if (prevProps.onDragStart !== this.props.onDragStart) {
        updatedDraggable.onDragStart = this.props.onDragStart;
      }
      if (prevProps.payload !== this.props.payload) {
        updatedDraggable.payload = this.props.payload;
      }

      if (Object.keys(updatedDraggable).length !== 0) {
        this.props.__dndContext.updateDraggable(
          this.identifier,
          updatedDraggable
        );
      }
    }

    onLayout = (...args: any[]) => {
      if (this.props.onLayout) {
        this.props.onLayout(...args);
      }

      this.measure();
    };

    handleRef = (element: any) => {
      if (element && element.getNode) {
        this.element = element.getNode();
      } else {
        this.element = element;
      }
    };

    measure() {
      if (this.element) {
        this.element.measureInWindow((x, y, width, height) => {
          this.props.__dndContext.updateDraggable(this.identifier, {
            layout: { x, y, width, height }
          });
        });
      }
    }

    render() {
      const { scale } = this.state
      const { children } = this.props;
      return (
        <Animated.View
          style={[{
            transform: [
              {
                scale
              }
            ]
          }
          ]}>
          {children({
          viewProps: Object.assign({ onPress: this.state.onPress, onLayout: this.onLayout, ref: this.handleRef, style: {
                  transform: this.state.pan.getTranslateTransform()
              } }, this.panResponder.panHandlers)})}
        </Animated.View>
      )
    }
  }

  const Draggable = React.forwardRef(
    (props: DraggableProps, ref?: React.Ref<BaseDraggable>) => (
      <Consumer>
        {dndContext => (
          <BaseDraggable {...props} ref={ref} __dndContext={dndContext} />
        )}
      </Consumer>
    )
  );
  Draggable.displayName = "ConnectedDraggable";

  return Draggable;
}
