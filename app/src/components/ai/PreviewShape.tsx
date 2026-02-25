import { useState, useCallback, useRef } from "react";
import { BaseBoxShapeUtil, HTMLContainer, TLShape, T } from "tldraw";

const PREVIEW_SHAPE_TYPE = "preview" as const;

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [PREVIEW_SHAPE_TYPE]: {
      html: string;
      w: number;
      h: number;
    };
  }
}

export type PreviewShape = TLShape<typeof PREVIEW_SHAPE_TYPE>;

export class PreviewShapeUtil extends BaseBoxShapeUtil<PreviewShape> {
  static override type = PREVIEW_SHAPE_TYPE;

  static override props = {
    html: T.string,
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): PreviewShape["props"] {
    return {
      html: "",
      w: 540,
      h: 440,
    };
  }

  override canEdit = () => true;
  override isAspectRatioLocked = () => false;
  override canResize = () => true;

  component(shape: PreviewShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const [isLoaded, setIsLoaded] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleLoad = useCallback(() => {
      setIsLoaded(true);
    }, []);

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <div className="preview-shape">
          {shape.props.html ? (
            <>
              <iframe
                ref={iframeRef}
                srcDoc={shape.props.html}
                className="preview-shape__iframe"
                style={{
                  pointerEvents: isEditing ? "all" : "none",
                  opacity: isLoaded ? 1 : 0,
                }}
                sandbox="allow-scripts allow-popups allow-forms"
                onLoad={handleLoad}
              />
              {!isLoaded && (
                <div className="preview-shape__loading">Loading...</div>
              )}
              {!isEditing && (
                <div
                  className="preview-shape__overlay"
                  onDoubleClick={() => this.editor.setEditingShape(shape.id)}
                />
              )}
            </>
          ) : (
            <div className="preview-shape__empty">
              <span>Generating...</span>
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: PreviewShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
